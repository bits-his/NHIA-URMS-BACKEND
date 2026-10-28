/**
 * Stakeholder Management — flat stakeholder_reports + stakeholder_outcomes + shared form_documents.
 * FE posts lines[]; each line → one row. Responses synthesize lines[] with outcomes/docs.
 */
const { Op } = require("sequelize");
const {
  StakeholderReport,
  StakeholderOutcome,
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

const FORM_KEY = "stakeholder";
const PROVIDER_STATUSES = [
  "draft", "awaiting_review", "returned", "endorsed", "submitted", "approved",
];

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

function followUpFromLine(line = {}) {
  const fd = line.follow_up_details && typeof line.follow_up_details === "object"
    ? line.follow_up_details
    : {};
  return {
    follow_up_required: line.follow_up_required || null,
    follow_up_date: line.follow_up_date || null,
    follow_up_visits: optNum(line.follow_up_visits),
    follow_up_priority: line.follow_up_priority || fd.priority || null,
    follow_up_action: line.follow_up_action || fd.action || null,
    follow_up_responsible: line.follow_up_responsible || fd.responsible || null,
    follow_up_status: line.follow_up_status || fd.status || null,
    follow_up_activity_conducted: line.follow_up_activity_conducted || fd.activity_conducted || null,
    follow_up_findings: line.follow_up_findings || fd.findings || null,
    follow_up_outstanding_issues: line.follow_up_outstanding_issues || fd.outstanding_issues || null,
    follow_up_further_action: line.follow_up_further_action || fd.further_action || null,
  };
}

function activityFromLine(line = {}) {
  let plannedText = line.planned_target_audience_text || null;
  if (!plannedText && line.activity_details) {
    try {
      const parsed = typeof line.activity_details === "string"
        ? JSON.parse(line.activity_details)
        : line.activity_details;
      if (parsed && typeof parsed === "object") {
        plannedText = parsed.planned_target_audience_text || parsed.planned_audience || null;
      } else if (typeof line.activity_details === "string") {
        plannedText = line.activity_details;
      }
    } catch {
      plannedText = typeof line.activity_details === "string" ? line.activity_details : null;
    }
  }

  const cats = pipeJoin(line.stakeholder_categories);
  return {
    engagement_code: line.engagement_code || null,
    activity_date: line.activity_date || null,
    engagement_category: line.engagement_category,
    stakeholder_categories: cats,
    stakeholder_names: line.stakeholder_names || (cats ? cats.replace(/\|/g, ", ") : null),
    specific_activity: line.specific_activity || null,
    engagement_purpose: line.engagement_purpose || null,
    funding_option: line.funding_option || null,
    activity_budget: optNum(line.activity_budget),
    approved_amount: optNum(line.approved_amount),
    planned_target_audience_text: plannedText,
    target_audience_reached: pipeJoin(line.target_audience_reached),
    location_category: line.location_category || null,
    location_name: line.location_name || null,
    location_specify: line.location_specify || null,
    programs_supported: pipeJoin(line.programs_supported),
    supporting_evidence_types: pipeJoin(line.supporting_evidence_types),
    ...followUpFromLine(line),
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
    expected_output: line.expected_output || null,
  };
}

function outcomesFromLine(line = {}) {
  if (Array.isArray(line.outcomes) && line.outcomes.length) {
    return line.outcomes
      .filter((o) => o && (o.outcome_category || o.specific_outcome))
      .map((o) => ({
        outcome_category: o.outcome_category || null,
        specific_outcome: o.specific_outcome || null,
      }));
  }
  if (line.outcome_category || line.specific_outcome) {
    return [{
      outcome_category: line.outcome_category || null,
      specific_outcome: line.specific_outcome || null,
    }];
  }
  return [];
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

async function replaceOutcomes(referenceId, outcomes) {
  await StakeholderOutcome.destroy({ where: { report_reference_id: referenceId } });
  let sn = 1;
  for (const o of outcomes) {
    await StakeholderOutcome.create({
      report_reference_id: referenceId,
      sn: sn++,
      outcome_category: o.outcome_category,
      specific_outcome: o.specific_outcome,
    });
  }
}

function syntheticLine(p, outcomes = [], docs = []) {
  const {
    supporting_documents,
    evidence_path,
    evidence_name,
    report_path,
    report_name,
  } = docsToArrays(docs);
  // Evidence also appears in supporting_documents for FE galleries that only read that array
  const allDocs = [...supporting_documents];
  if (evidence_path) allDocs.push({ name: evidence_name || "Evidence", path: evidence_path });
  if (report_path) allDocs.push({ name: report_name || "Report", path: report_path });

  const outcomeRows = outcomes.map((o) => {
    const row = o.toJSON ? o.toJSON() : o;
    return {
      outcome_category: row.outcome_category,
      specific_outcome: row.specific_outcome,
    };
  });
  const first = outcomeRows[0] || {};
  return {
    id: p.reference_id,
    report_id: p.reference_id,
    engagement_code: p.engagement_code,
    activity_date: p.activity_date,
    engagement_category: p.engagement_category,
    stakeholder_categories: pipeSplit(p.stakeholder_categories),
    stakeholder_names: p.stakeholder_names,
    specific_activity: p.specific_activity,
    engagement_purpose: p.engagement_purpose,
    funding_option: p.funding_option,
    activity_budget: p.activity_budget,
    approved_amount: p.approved_amount,
    planned_target_audience: null,
    planned_target_audience_text: p.planned_target_audience_text,
    target_audience_reached: pipeSplit(p.target_audience_reached),
    location_category: p.location_category,
    location_name: p.location_name,
    location_specify: p.location_specify,
    programs_supported: pipeSplit(p.programs_supported),
    supporting_evidence_types: pipeSplit(p.supporting_evidence_types),
    follow_up_required: p.follow_up_required,
    follow_up_date: p.follow_up_date,
    follow_up_visits: p.follow_up_visits,
    follow_up_details: {
      priority: p.follow_up_priority,
      action: p.follow_up_action,
      responsible: p.follow_up_responsible,
      status: p.follow_up_status,
      activity_conducted: p.follow_up_activity_conducted,
      findings: p.follow_up_findings,
      outstanding_issues: p.follow_up_outstanding_issues,
      further_action: p.follow_up_further_action,
    },
    supporting_documents: allDocs,
    evidence_path,
    evidence_name,
    report_path,
    report_name,
    outcome_category: first.outcome_category || null,
    specific_outcome: first.specific_outcome || null,
    outcomes: outcomeRows,
    expected_output: p.expected_output,
    activity_status: p.activity_status,
    remarks: p.remarks,
  };
}

async function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const outcomes = p.outcomes || await StakeholderOutcome.findAll({
    where: { report_reference_id: p.reference_id },
    order: [["sn", "ASC"]],
  });
  delete p.outcomes;
  const docs = await listDocuments(FORM_KEY, p.reference_id);
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
    lines: [syntheticLine(p, outcomes, docs)],
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
  { model: StakeholderOutcome, as: "outcomes" },
];

async function findReport(referenceId) {
  return StakeholderReport.findByPk(referenceId, {
    include: reportIncludes,
    order: [[{ model: StakeholderOutcome, as: "outcomes" }, "sn", "ASC"]],
  });
}

async function nextReferenceId() {
  const year = new Date().getFullYear();
  const fullPrefix = `STK-${year}-`;
  const last = await StakeholderReport.findOne({
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
    if (req.query.activity_module) where.activity_module = req.query.activity_module;

    if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
      where.zonal_code = req.user.zonal_code;
    }
    if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
      where.state_code = req.user.state_code;
    }

    const rows = await StakeholderReport.findAll({
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
    if (needsState && !geo.state_code) {
      return res.status(422).json({ success: false, message: "Please select a State before sending for review" });
    }
    // Zone is captured from the selected state (or user scope); required when sending for review.
    if (needsState && !geo.zonal_code) {
      return res.status(422).json({ success: false, message: "Please select a State before sending for review" });
    }

    const rawLines = Array.isArray(body.lines) && body.lines.length ? body.lines : [body];
    const lines = rawLines.filter((l) => l && l.engagement_category);
    if (!lines.length) {
      return res.status(422).json({ success: false, message: "At least one engagement with a category is required" });
    }

    const planned = optNum(body.planned_activities) ?? lines.length;
    const activity_module = body.activity_module || "engagement-coordination";
    const created = [];
    for (const line of lines) {
      const reference_id = await nextReferenceId();
      const row = await StakeholderReport.create({
        reference_id,
        activity_module,
        ...geo,
        reporting_year,
        reporting_month,
        quarter: quarterFromMonth(reporting_month),
        planned_activities: planned,
        submission_date: body.submission_date || null,
        submitted_by: body.submitted_by || req.user?.name || null,
        status,
        created_by_user_id: req.user?.id || null,
        ...activityFromLine(line),
      });
      await replaceOutcomes(reference_id, outcomesFromLine(line));
      const docs = docsFromLine(line);
      if (docs.length) await replaceDocuments(FORM_KEY, reference_id, docs);
      created.push(row);
    }

    res.status(201).json({ success: true, data: await mapReport(await findReport(created[0].reference_id)) });
  } catch (err) { next(err); }
};

const updateReport = async (req, res, next) => {
  try {
    const report = await StakeholderReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const body = req.body || {};
    const geo = geoFromBody(req.user, body);
    const reporting_year = body.reporting_year != null ? Number(body.reporting_year) : report.reporting_year;
    const reporting_month = body.reporting_month != null ? Number(body.reporting_month) : report.reporting_month;

    const rawLines = Array.isArray(body.lines) ? body.lines : null;
    let activityPatch = {};
    if (rawLines && rawLines.length) {
      const match = rawLines.find((l) =>
        String(l.id || l.reference_id || "") === String(report.reference_id)
      ) || rawLines[0];
      if (!match?.engagement_category) {
        return res.status(422).json({ success: false, message: "Engagement category is required" });
      }
      activityPatch = activityFromLine(match);
      await replaceOutcomes(report.reference_id, outcomesFromLine(match));
      await replaceDocuments(FORM_KEY, report.reference_id, docsFromLine(match));

      for (const line of rawLines) {
        const lineId = String(line.id || line.reference_id || "");
        if (lineId && lineId === String(report.reference_id)) continue;
        if (lineId) {
          const existing = await StakeholderReport.findByPk(lineId);
          if (existing) {
            await existing.update({
              ...activityFromLine(line),
              reporting_year,
              reporting_month,
              quarter: quarterFromMonth(reporting_month),
              status: body.status || existing.status,
            });
            await replaceOutcomes(existing.reference_id, outcomesFromLine(line));
            await replaceDocuments(FORM_KEY, existing.reference_id, docsFromLine(line));
            continue;
          }
        }
        if (!line.engagement_category) continue;
        const reference_id = await nextReferenceId();
        await StakeholderReport.create({
          reference_id,
          activity_module: body.activity_module || report.activity_module,
          zonal_code: geo.zonal_code || report.zonal_code,
          state_code: geo.state_code || report.state_code,
          department_code: geo.department_code ?? report.department_code,
          unit_code: geo.unit_code ?? report.unit_code,
          reporting_year,
          reporting_month,
          quarter: quarterFromMonth(reporting_month),
          planned_activities: optNum(body.planned_activities) ?? report.planned_activities,
          submission_date: body.submission_date !== undefined ? body.submission_date : report.submission_date,
          submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
          status: body.status || report.status,
          created_by_user_id: req.user?.id || null,
          ...activityFromLine(line),
        });
        await replaceOutcomes(reference_id, outcomesFromLine(line));
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
      activity_module: body.activity_module || report.activity_module,
      reporting_year,
      reporting_month,
      quarter: quarterFromMonth(reporting_month),
      planned_activities: body.planned_activities !== undefined
        ? optNum(body.planned_activities) : report.planned_activities,
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
    const report = await StakeholderReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
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
    let report = await StakeholderReport.findByPk(targetId);
    if (!report) report = await StakeholderReport.findByPk(req.params.id);
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

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
  updateStatus,
  uploadLineFiles,
  FORM_KEY,
};
