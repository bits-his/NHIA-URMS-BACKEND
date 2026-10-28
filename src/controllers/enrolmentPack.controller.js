/**
 * Enrolment Activity Reporting — single table, PK reference_id.
 * Accepts legacy body keys zone_id / state_id and optional lines[0] from FE.
 */
const { Op } = require("sequelize");
const {
  EnrolmentReport,
  ZonalOffice,
  StateOffice,
} = require("../models");

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

async function nextReferenceId() {
  const year = new Date().getFullYear();
  const fullPrefix = `ENR-${year}-`;
  const last = await EnrolmentReport.findOne({
    where: { reference_id: { [Op.like]: `${fullPrefix}%` } },
    order: [["reference_id", "DESC"]],
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(fullPrefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${fullPrefix}${String(next).padStart(5, "0")}`;
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

/** FE still posts lines[]; flatten first line (or top-level activity fields). */
function activityFromBody(body = {}) {
  const line = Array.isArray(body.lines) && body.lines.length ? body.lines[0] : body;
  let program_details = line.program_details ?? null;
  if (program_details && typeof program_details === "string") {
    try { program_details = JSON.parse(program_details); } catch { program_details = null; }
  }
  return {
    category: line.category,
    activity_code: line.activity_code || null,
    activity_date: line.activity_date || null,
    enrolment_channel: line.enrolment_channel || null,
    enrolment_type: line.enrolment_type || null,
    program_code: line.program_code || null,
    program_name: line.program_name || null,
    enrolment_category: line.enrolment_category || null,
    beneficiary_category: line.beneficiary_category || null,
    beneficiary_status: line.beneficiary_status || null,
    funding_option: line.funding_option || null,
    supporting_evidence: line.supporting_evidence || null,
    status_reason: line.status_reason || null,
    activity_budget: line.activity_budget != null && line.activity_budget !== ""
      ? Number(line.activity_budget) : null,
    approved_amount: line.approved_amount != null && line.approved_amount !== ""
      ? Number(line.approved_amount) : null,
    enrolment_count: Number(line.enrolment_count) || 0,
    enrollees_validated: line.enrollees_validated != null && line.enrollees_validated !== ""
      ? Number(line.enrollees_validated) : null,
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
    program_details,
  };
}

function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const line = {
    id: `${p.reference_id}-1`,
    report_id: p.reference_id,
    category: p.category,
    activity_code: p.activity_code,
    activity_date: p.activity_date,
    enrolment_channel: p.enrolment_channel,
    enrolment_type: p.enrolment_type,
    program_code: p.program_code,
    program_name: p.program_name,
    enrolment_category: p.enrolment_category,
    beneficiary_category: p.beneficiary_category,
    beneficiary_status: p.beneficiary_status,
    funding_option: p.funding_option,
    supporting_evidence: p.supporting_evidence,
    status_reason: p.status_reason,
    activity_budget: p.activity_budget,
    approved_amount: p.approved_amount,
    enrolment_count: p.enrolment_count,
    enrollees_validated: p.enrollees_validated,
    activity_status: p.activity_status,
    remarks: p.remarks,
    program_details: p.program_details,
    quarter: p.quarter,
  };
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
    lines: [line],
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
];

async function findReport(referenceId) {
  return EnrolmentReport.findByPk(referenceId, { include: reportIncludes });
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
    if (req.query.category) where.category = req.query.category;

    if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
      where.zonal_code = req.user.zonal_code;
    }
    if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
      where.state_code = req.user.state_code;
    }

    const rows = await EnrolmentReport.findAll({
      where,
      include: reportIncludes,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["reference_id", "DESC"]],
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
    if (!geo.zonal_code || !geo.state_code) {
      return res.status(422).json({ success: false, message: "Zone and state are required" });
    }
    const reporting_year = Number(body.reporting_year);
    const reporting_month = Number(body.reporting_month);
    if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
      return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
    }

    const activity = activityFromBody(body);
    if (!activity.category) {
      return res.status(422).json({ success: false, message: "Activity category is required" });
    }

    const status = body.status || "draft";
    if (status === "approved") {
      return res.status(422).json({
        success: false,
        message: "Send the report for review. Final approval follows the state coordinator's endorsement.",
      });
    }

    const reference_id = await nextReferenceId();
    const report = await EnrolmentReport.create({
      reference_id,
      ...geo,
      reporting_year,
      reporting_month,
      submission_date: body.submission_date || null,
      submitted_by: body.submitted_by || req.user?.name || null,
      status,
      ...activity,
      quarter: quarterFromMonth(reporting_month),
      created_by_user_id: req.user?.id || null,
    });

    const full = await findReport(report.reference_id);
    res.status(201).json({ success: true, data: mapReport(full) });
  } catch (err) { next(err); }
};

const updateReport = async (req, res, next) => {
  try {
    const report = await EnrolmentReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = body.reporting_year != null
      ? Number(body.reporting_year) : report.reporting_year;
    const reporting_month = body.reporting_month != null
      ? Number(body.reporting_month) : report.reporting_month;

    const hasActivity = Array.isArray(body.lines) || body.category != null;
    const activity = hasActivity ? activityFromBody(body) : null;
    if (activity && !activity.category) {
      return res.status(422).json({ success: false, message: "Activity category is required" });
    }

    await report.update({
      zonal_code: geo.zonal_code || report.zonal_code,
      state_code: geo.state_code || report.state_code,
      department_code: geo.department_code ?? report.department_code,
      unit_code: geo.unit_code ?? report.unit_code,
      reporting_year,
      reporting_month,
      submission_date: body.submission_date !== undefined
        ? body.submission_date : report.submission_date,
      submitted_by: body.submitted_by !== undefined
        ? body.submitted_by : report.submitted_by,
      status: body.status || report.status,
      quarter: quarterFromMonth(reporting_month),
      ...(activity || {}),
    });

    const full = await findReport(report.reference_id);
    res.json({ success: true, data: mapReport(full) });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const report = await EnrolmentReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    const { status, review_note, action } = req.body || {};
    if (!status) {
      return res.status(422).json({ success: false, message: "status is required" });
    }

    const patch = { status };
    if (action === "endorse" || status === "approved") {
      patch.coordinator_reviewed_by = req.user?.name || req.user?.staff_id || null;
      patch.coordinator_reviewed_at = new Date();
      if (review_note) patch.coordinator_review_note = review_note;
    } else if (review_note) {
      patch.coordinator_review_note = review_note;
    }

    await report.update(patch);
    const full = await findReport(report.reference_id);
    res.json({ success: true, data: mapReport(full) });
  } catch (err) { next(err); }
};

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
  updateStatus,
};
