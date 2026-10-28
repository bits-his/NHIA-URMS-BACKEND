/**
 * HMO Indebtedness Collation — hmo_indebtedness_reports + lines.
 */
const { Op } = require("sequelize");
const {
  HmoIndebtednessReport,
  HmoIndebtednessLine,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { money } = require("../utils/hmoIndebtednessCompile");

const STATUSES = ["draft", "submitted", "approved"];

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function mapLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .filter((l) => String(l.hmo_name || "").trim() && String(l.facility_name || "").trim())
    .map((l, i) => {
      const nhia_cap = money(l.nhia_cap);
      const nhia_ffs = money(l.nhia_ffs);
      const phi = money(l.phi);
      return {
        sn: i + 1,
        hmo_name: String(l.hmo_name).trim(),
        hmo_code: l.hmo_code ? String(l.hmo_code).trim() : null,
        facility_name: String(l.facility_name).trim(),
        hcf_code: l.hcf_code ? String(l.hcf_code).trim() : null,
        nhia_cap,
        nhia_ffs,
        phi,
        total: money(nhia_cap + nhia_ffs + phi),
      };
    });
}

async function replaceLines(referenceId, lines) {
  await HmoIndebtednessLine.destroy({ where: { report_reference_id: referenceId } });
  for (const line of lines) {
    await HmoIndebtednessLine.create({ report_reference_id: referenceId, ...line });
  }
}

function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const lines = (p.lines || []).map((l) => {
    const x = l.toJSON ? l.toJSON() : l;
    return { ...x, id: x.sn, sort_order: x.sn };
  }).sort((a, b) => a.sn - b.sn);
  delete p.lines;
  return {
    ...p,
    id: p.reference_id,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    zone: p.zone
      ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
      : undefined,
    state: p.state
      ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
      : undefined,
    lines,
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
  { model: HmoIndebtednessLine, as: "lines" },
];

async function findReport(id) {
  return HmoIndebtednessReport.findByPk(id, {
    include: reportIncludes,
    order: [[{ model: HmoIndebtednessLine, as: "lines" }, "sn", "ASC"]],
  });
}

async function nextReferenceId() {
  const year = new Date().getFullYear();
  const prefix = `HID-${year}-`;
  const last = await HmoIndebtednessReport.findOne({
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

function listWhere(req) {
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
  if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
    where.zonal_code = req.user.zonal_code;
  }
  if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
    where.state_code = req.user.state_code;
  }
  return where;
}

const listSheets = async (req, res, next) => {
  try {
    const rows = await HmoIndebtednessReport.findAll({
      where: listWhere(req),
      include: reportIncludes,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["reference_id", "DESC"]],
    });
    res.json({ success: true, data: rows.map(mapReport) });
  } catch (err) { next(err); }
};

const getSheet = async (req, res, next) => {
  try {
    const row = await findReport(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Sheet not found" });
    res.json({ success: true, data: mapReport(row) });
  } catch (err) { next(err); }
};

const createSheet = async (req, res, next) => {
  try {
    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = Number(body.reporting_year);
    const reporting_month = Number(body.reporting_month);
    if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
      return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
    }
    const status = body.status || "submitted";
    if (!STATUSES.includes(status)) {
      return res.status(422).json({ success: false, message: "Invalid status" });
    }
    if (status !== "draft" && (!geo.zonal_code || !geo.state_code)) {
      return res.status(422).json({ success: false, message: "Zone and state are required" });
    }
    const lines = mapLines(body.lines);
    const reference_id = await nextReferenceId();
    await HmoIndebtednessReport.create({
      reference_id,
      ...geo,
      reporting_year,
      reporting_month,
      quarter: quarterFromMonth(reporting_month),
      submission_date: body.submission_date || new Date().toISOString().slice(0, 10),
      submitted_by: body.submitted_by || req.user?.name || null,
      status,
      created_by_user_id: req.user?.id || null,
    });
    if (lines.length) await replaceLines(reference_id, lines);
    res.status(201).json({ success: true, data: mapReport(await findReport(reference_id)) });
  } catch (err) { next(err); }
};

const updateSheet = async (req, res, next) => {
  try {
    const report = await HmoIndebtednessReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Sheet not found" });
    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = body.reporting_year != null ? Number(body.reporting_year) : report.reporting_year;
    const reporting_month = body.reporting_month != null ? Number(body.reporting_month) : report.reporting_month;
    const status = body.status || report.status;
    if (!STATUSES.includes(status)) {
      return res.status(422).json({ success: false, message: "Invalid status" });
    }
    if (body.lines !== undefined) {
      await replaceLines(report.reference_id, mapLines(body.lines));
    }
    await report.update({
      zonal_code: geo.zonal_code || report.zonal_code,
      state_code: geo.state_code || report.state_code,
      department_code: geo.department_code ?? report.department_code,
      unit_code: geo.unit_code ?? report.unit_code,
      reporting_year,
      reporting_month,
      quarter: quarterFromMonth(reporting_month),
      submission_date: body.submission_date !== undefined ? body.submission_date : report.submission_date,
      submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
      status,
    });
    res.json({ success: true, data: mapReport(await findReport(report.reference_id)) });
  } catch (err) { next(err); }
};

module.exports = { listSheets, getSheet, createSheet, updateSheet };
