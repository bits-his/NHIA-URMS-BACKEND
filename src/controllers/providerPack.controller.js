/**
 * Provider Management — flat provider_management_reports + shared form_documents.
 * FE posts lines[]; each line → one row. Responses synthesize lines[] + activity_template.
 */
const { Op } = require("sequelize");
const {
  ProviderManagementReport,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { canReviewMonthlyReport } = require("../utils/monthlyReportScope");
const {
  listDocuments,
  replaceDocuments,
  appendDocuments,
  docsToArrays,
} = require("../utils/formDocuments");
const {
  FORM_TYPES,
  SEGMENT_TO_FORM,
  METRIC_LABEL_TO_COLUMN,
  COLUMN_TO_METRIC_LABEL,
  metaFor,
  prefixFor,
} = require("../utils/providerManagementTypes");

const FORM_KEY = "provider-management";
const PROVIDER_STATUSES = [
  "draft", "awaiting_review", "returned", "endorsed", "submitted", "approved",
];
const VALID_FORM_TYPES = FORM_TYPES.map((t) => t.key);

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

function optNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pipeJoin(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean).join("|") || null;
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function pipeSplit(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v).split("|").map((s) => s.trim()).filter(Boolean);
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function resolveFormType(req, line = {}, body = {}) {
  const fromReq = req.providerFormType
    || SEGMENT_TO_FORM[req.providerSegment]
    || null;
  const raw = line.form_type || body.form_type || body.activity_module || fromReq || "accreditation";
  return VALID_FORM_TYPES.includes(raw) ? raw : "accreditation";
}

function metricsFromLine(line = {}) {
  const out = {
    applications_received: null,
    forms_sold: null,
    completed_forms_returned: null,
    awaiting_accreditation: null,
    awaiting_reaccreditation: null,
    phcs_awaiting_accreditation: null,
    phcs_awaiting_reaccreditation: null,
  };
  const metrics = line.metrics && typeof line.metrics === "object" ? line.metrics : {};
  for (const [label, col] of Object.entries(METRIC_LABEL_TO_COLUMN)) {
    if (metrics[label] != null && metrics[label] !== "") {
      out[col] = optNum(metrics[label]);
    }
  }
  for (const col of Object.keys(out)) {
    if (line[col] != null && line[col] !== "") out[col] = optNum(line[col]);
  }
  return out;
}

function metricsToLabels(row = {}) {
  const metrics = {};
  for (const [col, label] of Object.entries(COLUMN_TO_METRIC_LABEL)) {
    if (row[col] != null && row[col] !== "") metrics[label] = Number(row[col]);
  }
  return metrics;
}

function activityFromLine(req, line = {}, body = {}) {
  const form_type = resolveFormType(req, line, body);
  const meta = metaFor(form_type);
  return {
    form_type,
    engagement_code: line.engagement_code || meta.code,
    engagement_category: line.engagement_category || meta.category,
    related_programme: line.related_programme
      || (Array.isArray(line.programs_supported) ? line.programs_supported[0] : null)
      || null,
    bhcpf_activity_type: line.bhcpf_activity_type || null,
    activity_date: line.activity_date || null,
    total_facilities_in_state: optNum(line.total_facilities_in_state),
    facilities_planned: optNum(line.facilities_planned ?? line.planned_target_stakeholders),
    facilities_covered: optNum(line.facilities_covered ?? line.stakeholders_engaged),
    funding_option: line.funding_option || null,
    activity_budget: optNum(line.activity_budget),
    approved_amount: optNum(line.approved_amount),
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
    supporting_evidence_types: pipeJoin(line.supporting_evidence_types),
    ...metricsFromLine(line),
  };
}

function docsFromLine(line = {}) {
  const out = [];
  const raw = Array.isArray(line.supporting_documents) ? line.supporting_documents : [];
  for (const d of raw) {
    if (!d || !d.path) continue;
    out.push({
      doc_kind: d.doc_kind || "supporting",
      name: d.name || "Document",
      path: d.path,
      mime: d.mime || null,
    });
  }
  return out;
}

function syntheticLine(p, docs = []) {
  const {
    supporting_documents,
    evidence_path,
    evidence_name,
    report_path,
    report_name,
  } = docsToArrays(docs);
  const allDocs = [...supporting_documents];
  if (evidence_path) allDocs.push({ name: evidence_name || "Evidence", path: evidence_path });
  if (report_path) allDocs.push({ name: report_name || "Report", path: report_path });

  const metrics = metricsToLabels(p);
  const activity_template = {
    provider_management_id: p.reference_id,
    form_type: p.form_type,
    engagement_code: p.engagement_code,
    engagement_category: p.engagement_category,
    related_programme: p.related_programme,
    bhcpf_activity_type: p.bhcpf_activity_type,
    activity_date: p.activity_date,
    total_facilities_in_state: p.total_facilities_in_state,
    facilities_planned: p.facilities_planned,
    facilities_covered: p.facilities_covered,
    funding_option: p.funding_option,
    activity_budget: p.activity_budget,
    approved_amount: p.approved_amount,
    activity_status: p.activity_status,
    remarks: p.remarks,
    metrics,
    supporting_documents: allDocs,
    supporting_evidence_types: pipeSplit(p.supporting_evidence_types),
    programs_supported: p.related_programme ? [p.related_programme] : [],
    planned_target_stakeholders: p.facilities_planned,
    stakeholders_engaged: p.facilities_covered,
  };

  return {
    id: p.reference_id,
    report_id: p.reference_id,
    ...activity_template,
    activity_template,
    evidence_path,
    evidence_name,
    report_path,
    report_name,
  };
}

async function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const docs = await listDocuments(FORM_KEY, p.reference_id);
  return {
    ...p,
    id: p.reference_id,
    activity_module: p.form_type,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    zone: p.zone
      ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
      : undefined,
    state: p.state
      ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
      : undefined,
    planned_activities: 1,
    lines: [syntheticLine(p, docs)],
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
];

async function findReport(referenceId) {
  return ProviderManagementReport.findByPk(referenceId, { include: reportIncludes });
}

async function nextReferenceId(formType) {
  const year = new Date().getFullYear();
  const prefix = `${prefixFor(formType)}-${year}-`;
  const last = await ProviderManagementReport.findOne({
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

const isCoordinatorRole = (role) => /(^|-)(state|zonal)-coordinator$/.test(String(role || ""));

async function patchStatus(req, report) {
  const { status, review_note: reviewNote } = req.body || {};
  if (!PROVIDER_STATUSES.includes(status)) {
    const err = new Error("Invalid status");
    err.status = 422;
    throw err;
  }
  const role = String(req.user?.role || "");
  const reviewer = role === "admin" || isCoordinatorRole(role) || await canReviewMonthlyReport(role);
  const reviewerName = req.user?.name || req.user?.staff_id || "Reviewer";
  const note = reviewNote && String(reviewNote).trim() ? String(reviewNote).trim() : null;

  const patch = { status };
  if (["awaiting_review", "returned", "endorsed", "approved"].includes(status)) {
    if (!reviewer && status !== "awaiting_review") {
      const err = new Error("Only a coordinator can set this status");
      err.status = 403;
      throw err;
    }
    if (status !== "awaiting_review") {
      patch.coordinator_reviewed_by = reviewerName;
      patch.coordinator_reviewed_at = new Date();
      if (note) patch.coordinator_review_note = note;
    }
  } else if (note) {
    patch.coordinator_review_note = note;
  }
  await report.update(patch);
}

function formTypeFilter(req) {
  if (req.providerFormType) return req.providerFormType;
  if (req.query.form_type && VALID_FORM_TYPES.includes(req.query.form_type)) {
    return req.query.form_type;
  }
  if (req.query.activity_module && VALID_FORM_TYPES.includes(req.query.activity_module)) {
    return req.query.activity_module;
  }
  return null;
}

const listReports = async (req, res, next) => {
  try {
    const where = {};
    const formType = formTypeFilter(req);
    if (formType) where.form_type = formType;

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

    const rows = await ProviderManagementReport.findAll({
      where,
      include: reportIncludes,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["reference_id", "DESC"]],
    });
    const data = [];
    for (const r of rows) data.push(await mapReport(r));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getReport = async (req, res, next) => {
  try {
    const row = await findReport(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Report not found" });
    if (req.providerFormType && row.form_type !== req.providerFormType) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    res.json({ success: true, data: await mapReport(row) });
  } catch (err) { next(err); }
};

const createReport = async (req, res, next) => {
  try {
    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = Number(body.reporting_year);
    const reporting_month = Number(body.reporting_month);
    if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
      return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
    }

    const status = body.status || "draft";
    if (!PROVIDER_STATUSES.includes(status) || status === "approved") {
      return res.status(422).json({
        success: false,
        message: status === "approved"
          ? "Send the report for review before final approval."
          : "Invalid status",
      });
    }
    const needsState = !["draft", "returned"].includes(status);
    if (needsState && (!geo.state_code || !geo.zonal_code)) {
      return res.status(422).json({ success: false, message: "Please select a State before sending for review" });
    }

    const rawLines = Array.isArray(body.lines) && body.lines.length ? body.lines : [body];
    const lines = rawLines.filter((l) => l && (l.engagement_category || l.form_type || l.related_programme || l.activity_date));
    if (!lines.length) {
      return res.status(422).json({ success: false, message: "At least one activity is required" });
    }

    const created = [];
    for (const line of lines) {
      const activity = activityFromLine(req, line, body);
      const reference_id = await nextReferenceId(activity.form_type);
      const row = await ProviderManagementReport.create({
        reference_id,
        ...geo,
        reporting_year,
        reporting_month,
        quarter: quarterFromMonth(reporting_month),
        submission_date: body.submission_date || null,
        submitted_by: body.submitted_by || req.user?.name || null,
        status,
        created_by_user_id: req.user?.id || null,
        ...activity,
      });
      const docs = docsFromLine(line);
      if (docs.length) await replaceDocuments(FORM_KEY, reference_id, docs);
      created.push(row);
    }

    res.status(201).json({ success: true, data: await mapReport(await findReport(created[0].reference_id)) });
  } catch (err) { next(err); }
};

const updateReport = async (req, res, next) => {
  try {
    const report = await ProviderManagementReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    if (req.providerFormType && report.form_type !== req.providerFormType) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = body.reporting_year != null ? Number(body.reporting_year) : report.reporting_year;
    const reporting_month = body.reporting_month != null ? Number(body.reporting_month) : report.reporting_month;

    const rawLines = Array.isArray(body.lines) ? body.lines : null;
    let activityPatch = {};
    if (rawLines && rawLines.length) {
      const match = rawLines.find((l) =>
        String(l.id || l.reference_id || l.provider_management_id || "") === String(report.reference_id)
      ) || rawLines[0];
      activityPatch = activityFromLine(req, match, body);
      await replaceDocuments(FORM_KEY, report.reference_id, docsFromLine(match));

      for (const line of rawLines) {
        const lineId = String(line.id || line.reference_id || line.provider_management_id || "");
        if (lineId && lineId === String(report.reference_id)) continue;
        if (lineId) {
          const existing = await ProviderManagementReport.findByPk(lineId);
          if (existing) {
            await existing.update({
              ...activityFromLine(req, line, body),
              reporting_year,
              reporting_month,
              quarter: quarterFromMonth(reporting_month),
              status: body.status || existing.status,
              zonal_code: geo.zonal_code || existing.zonal_code,
              state_code: geo.state_code || existing.state_code,
            });
            await replaceDocuments(FORM_KEY, existing.reference_id, docsFromLine(line));
            continue;
          }
        }
        if (!(line.engagement_category || line.related_programme || line.activity_date)) continue;
        const activity = activityFromLine(req, line, body);
        const reference_id = await nextReferenceId(activity.form_type);
        await ProviderManagementReport.create({
          reference_id,
          zonal_code: geo.zonal_code || report.zonal_code,
          state_code: geo.state_code || report.state_code,
          department_code: geo.department_code ?? report.department_code,
          unit_code: geo.unit_code ?? report.unit_code,
          reporting_year,
          reporting_month,
          quarter: quarterFromMonth(reporting_month),
          submission_date: body.submission_date !== undefined ? body.submission_date : report.submission_date,
          submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
          status: body.status || report.status,
          created_by_user_id: req.user?.id || null,
          ...activity,
        });
        const docs = docsFromLine(line);
        if (docs.length) await replaceDocuments(FORM_KEY, reference_id, docs);
      }
    }

    const nextStatus = body.status || report.status;
    if (!["draft", "returned"].includes(nextStatus)) {
      const stateCode = geo.state_code || report.state_code;
      if (!stateCode) {
        return res.status(422).json({
          success: false,
          message: "Please select a State before sending for review",
        });
      }
    }

    await report.update({
      zonal_code: geo.zonal_code || report.zonal_code,
      state_code: geo.state_code !== undefined && geo.state_code !== null
        ? geo.state_code
        : report.state_code,
      department_code: geo.department_code ?? report.department_code,
      unit_code: geo.unit_code ?? report.unit_code,
      reporting_year,
      reporting_month,
      quarter: quarterFromMonth(reporting_month),
      submission_date: body.submission_date !== undefined ? body.submission_date : report.submission_date,
      submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
      status: nextStatus,
      ...activityPatch,
    });

    res.json({ success: true, data: await mapReport(await findReport(report.reference_id)) });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const report = await ProviderManagementReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    if (req.providerFormType && report.form_type !== req.providerFormType) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    try {
      await patchStatus(req, report);
    } catch (e) {
      return res.status(e.status || 500).json({ success: false, message: e.message });
    }
    res.json({ success: true, data: await mapReport(await findReport(report.reference_id)) });
  } catch (err) { next(err); }
};

const uploadLineFiles = async (req, res, next) => {
  try {
    const targetId = req.params.lineId || req.params.id;
    let report = await ProviderManagementReport.findByPk(targetId);
    if (!report) report = await ProviderManagementReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    const files = req.files || [];
    if (!files.length && !req.file) {
      return res.status(422).json({ success: false, message: "No file uploaded" });
    }
    const list = files.length ? files : [req.file];
    const added = list.filter(Boolean).map((f) => ({
      doc_kind: "supporting",
      name: f.originalname,
      path: `/uploads/beneficiary/${f.filename}`,
      mime: f.mimetype || null,
    }));
    await appendDocuments(FORM_KEY, report.reference_id, added);
    const mapped = await mapReport(await findReport(report.reference_id));
    res.json({ success: true, data: mapped.lines[0] });
  } catch (err) { next(err); }
};

/** Thin alias middleware factory — locks form_type to a segment. */
function lockFormType(formTypeOrSegment) {
  const formType = VALID_FORM_TYPES.includes(formTypeOrSegment)
    ? formTypeOrSegment
    : SEGMENT_TO_FORM[formTypeOrSegment] || null;
  return (req, _res, next) => {
    req.providerFormType = formType;
    req.providerSegment = formTypeOrSegment;
    next();
  };
}

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
  updateStatus,
  uploadLineFiles,
  lockFormType,
  FORM_KEY,
  FORM_TYPES,
};
