/**
 * HMO Reconciliation — hmo_recon_reports + lines (stream_type = phi|ffs|cap).
 */
const { Op } = require("sequelize");
const {
  HmoReconReport,
  HmoReconLine,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { money } = require("../utils/hmoIndebtednessCompile");

const STATUSES = ["draft", "submitted", "approved"];
const STREAMS = new Set(["phi", "ffs", "cap"]);
const PREFIX = { phi: "HRP", ffs: "HRF", cap: "HRC" };

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

function resolveStream(req) {
  const stream = String(req.query.stream || req.body?.stream_type || "").toLowerCase();
  return STREAMS.has(stream) ? stream : null;
}

function mapLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .filter((l) => String(l.hcf_name || "").trim())
    .map((l, i) => {
      const alleged_amount = money(l.alleged_amount);
      const actual_amount = money(l.actual_amount);
      const agreed_amount = money(l.agreed_amount);
      const amount_paid = money(l.amount_paid);
      const outstanding = l.outstanding != null && l.outstanding !== ""
        ? money(l.outstanding)
        : money(agreed_amount - amount_paid);
      return {
        sn: i + 1,
        hcf_name: String(l.hcf_name).trim(),
        hcf_code: l.hcf_code ? String(l.hcf_code).trim() : null,
        alleged_amount,
        actual_amount,
        agreed_amount,
        amount_paid,
        outstanding,
        remarks: l.remarks ? String(l.remarks).trim() : null,
      };
    });
}

async function replaceLines(referenceId, lines) {
  await HmoReconLine.destroy({ where: { report_reference_id: referenceId } });
  for (const line of lines) {
    await HmoReconLine.create({ report_reference_id: referenceId, ...line });
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
  { model: HmoReconLine, as: "lines" },
];

async function findReport(id) {
  return HmoReconReport.findByPk(id, {
    include: reportIncludes,
    order: [[{ model: HmoReconLine, as: "lines" }, "sn", "ASC"]],
  });
}

async function nextReferenceId(stream) {
  const year = new Date().getFullYear();
  const prefix = `${PREFIX[stream] || "HRN"}-${year}-`;
  const last = await HmoReconReport.findOne({
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

function listWhere(req, stream) {
  const where = { stream_type: stream };
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
  if (req.query.hmo) where.hmo_name = String(req.query.hmo);
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
    const stream = resolveStream(req);
    if (!stream) {
      return res.status(400).json({ success: false, message: "stream query (phi|ffs|cap) is required" });
    }
    const rows = await HmoReconReport.findAll({
      where: listWhere(req, stream),
      include: reportIncludes,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["hmo_name", "ASC"], ["reference_id", "DESC"]],
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
    const stream = resolveStream(req);
    if (!stream) {
      return res.status(400).json({ success: false, message: "stream_type (phi|ffs|cap) is required" });
    }
    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = Number(body.reporting_year);
    const reporting_month = Number(body.reporting_month);
    if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
      return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
    }
    if (!String(body.hmo_name || "").trim()) {
      return res.status(400).json({ success: false, message: "HMO name is required" });
    }
    const status = body.status || "submitted";
    if (!STATUSES.includes(status)) {
      return res.status(422).json({ success: false, message: "Invalid status" });
    }
    if (status !== "draft" && (!geo.zonal_code || !geo.state_code)) {
      return res.status(422).json({ success: false, message: "Zone and state are required" });
    }
    const lines = mapLines(body.lines);
    const reference_id = await nextReferenceId(stream);
    await HmoReconReport.create({
      reference_id,
      stream_type: stream,
      ...geo,
      reporting_year,
      reporting_month,
      quarter: quarterFromMonth(reporting_month),
      hmo_name: String(body.hmo_name).trim(),
      hmo_code: body.hmo_code ? String(body.hmo_code).trim() : null,
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
    const report = await HmoReconReport.findByPk(req.params.id);
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
      hmo_name: body.hmo_name != null ? String(body.hmo_name).trim() : report.hmo_name,
      hmo_code: body.hmo_code !== undefined
        ? (body.hmo_code ? String(body.hmo_code).trim() : null)
        : report.hmo_code,
      submission_date: body.submission_date !== undefined ? body.submission_date : report.submission_date,
      submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
      status,
    });
    res.json({ success: true, data: mapReport(await findReport(report.reference_id)) });
  } catch (err) { next(err); }
};

module.exports = { listSheets, getSheet, createSheet, updateSheet };
