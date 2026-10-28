/**
 * Weekly Compliance — weekly_compliance_reports + weekly_compliance_indicators.
 * FE posts indicators{}; child rows replace on create/update. Response rebuilds indicators bag.
 */
const { Op } = require("sequelize");
const {
  WeeklyComplianceReport,
  WeeklyComplianceIndicator,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { INDICATORS, sectionFor } = require("../utils/weeklyComplianceTypes");

const STATUSES = ["draft", "submitted", "approved"];

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

/** ISO week "2026-W41" → { year, month } of that week's Monday. */
function periodFromWeek(week) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(week || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const wk = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7);
  return { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1 };
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function normalizeAnswer(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase();
  if (s === "yes" || s === "no") return s;
  return null;
}

function indicatorsFromBody(indicators = {}) {
  const rows = [];
  let sn = 1;
  // Prefer catalog order; also accept unknown keys appended
  const seen = new Set();
  for (const def of INDICATORS) {
    const raw = indicators[def.indicator_key];
    if (!raw && raw !== 0) {
      // still create row if present as empty? only when any indicators sent
      continue;
    }
    seen.add(def.indicator_key);
    rows.push({
      sn: sn++,
      section_key: def.section_key,
      indicator_key: def.indicator_key,
      answer: normalizeAnswer(raw?.answer),
      remarks: raw?.remarks != null && String(raw.remarks).trim()
        ? String(raw.remarks).trim()
        : null,
    });
  }
  for (const [key, raw] of Object.entries(indicators || {})) {
    if (seen.has(key) || !raw) continue;
    const section = sectionFor(key) || "service_delivery";
    rows.push({
      sn: sn++,
      section_key: section,
      indicator_key: key,
      answer: normalizeAnswer(raw?.answer),
      remarks: raw?.remarks != null && String(raw.remarks).trim()
        ? String(raw.remarks).trim()
        : null,
    });
  }
  // If FE sent a full bag, ensure all catalog keys exist even unanswered
  if (indicators && typeof indicators === "object" && Object.keys(indicators).length) {
    const have = new Set(rows.map((r) => r.indicator_key));
    for (const def of INDICATORS) {
      if (have.has(def.indicator_key)) continue;
      const raw = indicators[def.indicator_key] || {};
      rows.push({
        sn: sn++,
        section_key: def.section_key,
        indicator_key: def.indicator_key,
        answer: normalizeAnswer(raw?.answer),
        remarks: raw?.remarks != null && String(raw.remarks).trim()
          ? String(raw.remarks).trim()
          : null,
      });
    }
  }
  return rows.sort((a, b) => a.sn - b.sn).map((r, i) => ({ ...r, sn: i + 1 }));
}

async function replaceIndicators(referenceId, indicatorRows) {
  await WeeklyComplianceIndicator.destroy({ where: { report_reference_id: referenceId } });
  for (const row of indicatorRows) {
    await WeeklyComplianceIndicator.create({
      report_reference_id: referenceId,
      sn: row.sn,
      section_key: row.section_key,
      indicator_key: row.indicator_key,
      answer: row.answer,
      remarks: row.remarks,
    });
  }
}

function indicatorsBag(indicatorRows = []) {
  const out = {};
  for (const row of indicatorRows) {
    const r = row.toJSON ? row.toJSON() : row;
    out[r.indicator_key] = {
      answer: r.answer || "",
      remarks: r.remarks || "",
    };
  }
  return out;
}

function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const inds = p.indicators || [];
  delete p.indicators;
  return {
    ...p,
    id: p.reference_id,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    zone: p.zone
      ? {
        ...p.zone,
        id: p.zone.zonal_code || p.zonal_code,
        description: p.zone.description,
      }
      : undefined,
    state: p.state
      ? {
        ...p.state,
        id: p.state.code || p.state_code,
        description: p.state.description,
      }
      : undefined,
    indicators: indicatorsBag(inds),
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
  { model: WeeklyComplianceIndicator, as: "indicators" },
];

async function findReport(referenceId) {
  return WeeklyComplianceReport.findByPk(referenceId, {
    include: reportIncludes,
    order: [[{ model: WeeklyComplianceIndicator, as: "indicators" }, "sn", "ASC"]],
  });
}

async function nextReferenceId() {
  const year = new Date().getFullYear();
  const prefix = `WCR-${year}-`;
  const last = await WeeklyComplianceReport.findOne({
    where: { reference_id: { [Op.like]: `${prefix}%` } },
    order: [["reference_id", "DESC"]],
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(5, "0")}`;
}

function headerFromBody(body = {}) {
  const facility_type = body.facility_type || null;
  return {
    facility_id: body.facility_id || null,
    facility_name: body.facility_name,
    nhia_code: body.nhia_code || null,
    facility_type,
    facility_type_other: facility_type === "Other" ? (body.facility_type_other || null) : null,
    facility_address: body.facility_address || null,
    compliance_officer: body.compliance_officer || null,
    designation_staff_id: body.designation_staff_id || null,
    submission_date: body.submission_date || null,
  };
}

async function assertUniqueFacilityWeek({ state_code, reporting_week, nhia_code, facility_id, excludeRef }) {
  if (!state_code || !reporting_week) return;
  if (nhia_code) {
    const where = { state_code, reporting_week, nhia_code };
    if (excludeRef) where.reference_id = { [Op.ne]: excludeRef };
    const hit = await WeeklyComplianceReport.findOne({ where });
    if (hit) {
      const err = new Error("A weekly compliance report already exists for this facility and week");
      err.status = 409;
      throw err;
    }
    return;
  }
  if (facility_id) {
    const where = { state_code, reporting_week, facility_id };
    if (excludeRef) where.reference_id = { [Op.ne]: excludeRef };
    const hit = await WeeklyComplianceReport.findOne({ where });
    if (hit) {
      const err = new Error("A weekly compliance report already exists for this facility and week");
      err.status = 409;
      throw err;
    }
  }
}

const listReports = async (req, res, next) => {
  try {
    const where = {};
    const zonal = req.query.zonal_code || req.query.zone_id;
    const state = req.query.state_code || req.query.state_id;
    if (zonal) where.zonal_code = zonal;
    if (state) where.state_code = state;
    if (req.query.year || req.query.reporting_year) {
      where.reporting_year = Number(req.query.year || req.query.reporting_year);
    }
    if (req.query.month || req.query.reporting_month) {
      where.reporting_month = Number(req.query.month || req.query.reporting_month);
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.reporting_week) where.reporting_week = req.query.reporting_week;

    if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
      where.zonal_code = req.user.zonal_code;
    }
    if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
      where.state_code = req.user.state_code;
    }

    const rows = await WeeklyComplianceReport.findAll({
      where,
      include: reportIncludes,
      order: [["reporting_week", "DESC"], ["reference_id", "DESC"]],
    });
    res.json({ success: true, data: rows.map(mapReport) });
  } catch (err) { next(err); }
};

const getReport = async (req, res, next) => {
  try {
    const row = await findReport(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, data: mapReport(row) });
  } catch (err) { next(err); }
};

const createReport = async (req, res, next) => {
  try {
    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_week = body.reporting_week;
    const period = periodFromWeek(reporting_week);
    if (!period) {
      return res.status(422).json({ success: false, message: "Valid reporting week is required" });
    }
    if (!body.facility_name || !String(body.facility_name).trim()) {
      return res.status(422).json({ success: false, message: "Facility name is required" });
    }

    const status = body.status || "submitted";
    if (!STATUSES.includes(status)) {
      return res.status(422).json({ success: false, message: "Invalid status" });
    }
    if (status !== "draft" && (!geo.zonal_code || !geo.state_code)) {
      return res.status(422).json({ success: false, message: "Zone and state are required" });
    }

    const header = headerFromBody(body);
    try {
      await assertUniqueFacilityWeek({
        state_code: geo.state_code,
        reporting_week,
        nhia_code: header.nhia_code,
        facility_id: header.facility_id,
      });
    } catch (e) {
      return res.status(e.status || 500).json({ success: false, message: e.message });
    }

    const reference_id = await nextReferenceId();
    await WeeklyComplianceReport.create({
      reference_id,
      ...geo,
      reporting_week,
      reporting_year: period.year,
      reporting_month: period.month,
      quarter: quarterFromMonth(period.month),
      ...header,
      submitted_by: body.submitted_by || req.user?.name || null,
      status,
      created_by_user_id: req.user?.id || null,
    });

    const indRows = indicatorsFromBody(body.indicators);
    if (indRows.length) await replaceIndicators(reference_id, indRows);

    res.status(201).json({ success: true, data: mapReport(await findReport(reference_id)) });
  } catch (err) { next(err); }
};

const updateReport = async (req, res, next) => {
  try {
    const report = await WeeklyComplianceReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_week = body.reporting_week != null ? body.reporting_week : report.reporting_week;
    let reporting_year = report.reporting_year;
    let reporting_month = report.reporting_month;
    if (body.reporting_week != null) {
      const period = periodFromWeek(reporting_week);
      if (!period) {
        return res.status(422).json({ success: false, message: "Valid reporting week is required" });
      }
      reporting_year = period.year;
      reporting_month = period.month;
    }

    const header = headerFromBody({ ...report.toJSON(), ...body });
    if (!header.facility_name || !String(header.facility_name).trim()) {
      return res.status(422).json({ success: false, message: "Facility name is required" });
    }

    const nextStatus = body.status || report.status;
    if (!STATUSES.includes(nextStatus)) {
      return res.status(422).json({ success: false, message: "Invalid status" });
    }
    const stateCode = geo.state_code || report.state_code;
    const zonalCode = geo.zonal_code || report.zonal_code;
    if (nextStatus !== "draft" && (!stateCode || !zonalCode)) {
      return res.status(422).json({ success: false, message: "Zone and state are required" });
    }

    try {
      await assertUniqueFacilityWeek({
        state_code: stateCode,
        reporting_week,
        nhia_code: header.nhia_code,
        facility_id: header.facility_id,
        excludeRef: report.reference_id,
      });
    } catch (e) {
      return res.status(e.status || 500).json({ success: false, message: e.message });
    }

    if (body.indicators !== undefined) {
      await replaceIndicators(report.reference_id, indicatorsFromBody(body.indicators));
    }

    await report.update({
      zonal_code: geo.zonal_code || report.zonal_code,
      state_code: geo.state_code != null && geo.state_code !== "" ? geo.state_code : report.state_code,
      department_code: geo.department_code ?? report.department_code,
      unit_code: geo.unit_code ?? report.unit_code,
      reporting_week,
      reporting_year,
      reporting_month,
      quarter: quarterFromMonth(reporting_month),
      ...header,
      submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
      status: nextStatus,
    });

    res.json({ success: true, data: mapReport(await findReport(report.reference_id)) });
  } catch (err) { next(err); }
};

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
};
