const sequelize = require("../config/database");
const {
  ComplianceReport, ComplianceFinding, ComplianceViolation,
  ComplianceEnforcementAction, ZonalOffice, StateOffice,
} = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");
const { formatComplianceReportId } = require("../utils/complianceReportId");
const { removeCertFile, publicCertPath } = require("../middleware/complianceCertUpload");

const quarterFromWeek = (week) => Math.min(4, Math.ceil(Number(week) / 13) || 1);

const isoWeekNow = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const includeAll = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] },
  { model: StateOffice, as: "state", attributes: ["id", "description", "code"] },
  { model: ComplianceFinding, as: "findings" },
  { model: ComplianceViolation, as: "violations" },
  { model: ComplianceEnforcementAction, as: "enforcement_actions" },
];

function parseMaybeJson(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function coerceMultipartBody(body = {}) {
  const out = { ...body };
  out.findings = parseMaybeJson(out.findings, []);
  out.violations = parseMaybeJson(out.violations, []);
  out.enforcement_actions = parseMaybeJson(out.enforcement_actions, []);
  out.complaint_categories = parseMaybeJson(out.complaint_categories, out.complaint_categories);
  if (out.follow_up_required === "true" || out.follow_up_required === true) out.follow_up_required = true;
  else if (out.follow_up_required === "false" || out.follow_up_required === false) out.follow_up_required = false;
  return out;
}

async function generateRefId(stateId, facilityCode, reportingYear, reportingWeek, t) {
  const state = await StateOffice.findByPk(stateId, {
    attributes: ["id", "code", "description"],
    transaction: t,
  });
  const base = formatComplianceReportId(state, facilityCode, reportingYear, reportingWeek);
  const existing = await ComplianceReport.count({ where: { reference_id: base }, transaction: t });
  if (!existing) return base;
  return `${base}-${String(existing + 1).padStart(2, "0")}`;
}

function mapNested(reportId, { findings = [], violations = [], enforcement_actions = [] }) {
  return {
    findings: findings.map((f) => ({
      report_id: reportId,
      section: f.section,
      indicator: f.indicator,
      status: f.status || "fully_compliant",
      remarks: f.remarks || null,
    })),
    violations: violations.map((v) => ({
      report_id: reportId,
      nature_of_violation: v.nature_of_violation,
      nhia_act_section: v.nhia_act_section || null,
      occurrences: Number(v.occurrences) || 0,
      action_taken: v.action_taken || null,
    })),
    enforcement_actions: enforcement_actions.map((e) => ({
      report_id: reportId,
      enforcement_action: e.enforcement_action,
      details: e.details || null,
    })),
  };
}

function normalizeCategories(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function headerFields(body, defaults = {}) {
  const reportingWeek = Number(body.reporting_week) || defaults.reporting_week || isoWeekNow();
  const reportingYear = Number(body.reporting_year) || defaults.reporting_year || new Date().getFullYear();
  return {
    zone_id: body.zone_id,
    state_id: body.state_id,
    reporting_year: reportingYear,
    reporting_week: reportingWeek,
    reporting_quarter: quarterFromWeek(reportingWeek),
    officer_name: body.officer_name || null,
    officer_staff_id: body.officer_staff_id || null,
    date_submitted: body.date_submitted || null,
    reviewed_by: body.reviewed_by || null,
    compliance_status_confirmed: body.compliance_status_confirmed || "pending",
    follow_up_required: !!body.follow_up_required,
    certification: body.certification || null,
    certification_file_path: body.certification_file_path ?? defaults.certification_file_path ?? null,
    certification_original_name: body.certification_original_name ?? defaults.certification_original_name ?? null,
    facility_name: body.facility_name || null,
    facility_code: body.facility_code || null,
    facility_type: body.facility_type || null,
    ownership: body.ownership || null,
    facility_address: body.facility_address || null,
    complaints_received: Number(body.complaints_received) || 0,
    complaint_categories: normalizeCategories(body.complaint_categories),
    resolved_at_facility: Number(body.resolved_at_facility) || 0,
    escalated_to: body.escalated_to || "none",
    complaint_summary: body.complaint_summary || null,
    state_office_remarks: body.state_office_remarks || null,
    submitted_by: body.submitted_by || null,
    ...(body.status && { status: body.status }),
  };
}

const findReport = (id) => ComplianceReport.findByPk(id, { include: includeAll });

function serializeReport(report) {
  if (!report) return report;
  const plain = report.toJSON ? report.toJSON() : { ...report };
  plain.complaint_categories = normalizeCategories(plain.complaint_categories);
  const fc = { fully_compliant: 0, partially_compliant: 0, non_compliant: 0 };
  for (const f of plain.findings ?? []) {
    if (f.status in fc) fc[f.status] += 1;
  }
  plain.finding_counts = fc;
  return plain;
}

const listReports = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const list = await ComplianceReport.findAll({
      where,
      include: includeAll,
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: list.map(serializeReport) });
  } catch (err) { next(err); }
};

const getReport = async (req, res, next) => {
  try {
    const report = await findReport(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    res.json({ success: true, data: serializeReport(report) });
  } catch (err) { next(err); }
};

const createReport = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const scoped = await applyScopeToBody(req.user, coerceMultipartBody(req.body));
    const {
      findings = [], violations = [], enforcement_actions = [],
      status = "draft",
    } = scoped;

    const header = headerFields(scoped);
    if (req.file) {
      header.certification_file_path = publicCertPath(req.file.filename);
      header.certification_original_name = req.file.originalname;
    }
    const reference_id = await generateRefId(
      header.state_id, scoped.facility_code, header.reporting_year, header.reporting_week, t,
    );

    const report = await ComplianceReport.create({
      reference_id, ...header, status,
    }, { transaction: t });

    const nested = mapNested(report.id, { findings, violations, enforcement_actions });
    if (nested.findings.length) await ComplianceFinding.bulkCreate(nested.findings, { transaction: t });
    if (nested.violations.length) await ComplianceViolation.bulkCreate(nested.violations, { transaction: t });
    if (nested.enforcement_actions.length) {
      await ComplianceEnforcementAction.bulkCreate(nested.enforcement_actions, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ success: true, data: serializeReport(await findReport(report.id)) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateReport = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const report = await ComplianceReport.findByPk(req.params.id, { transaction: t });
    if (!report) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      await t.rollback();
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const scoped = await applyScopeToBody(req.user, coerceMultipartBody(req.body));
    const {
      findings = [], violations = [], enforcement_actions = [],
    } = scoped;

    const header = headerFields(scoped, report);
    if (req.file) {
      if (report.certification_file_path) removeCertFile(report.certification_file_path);
      header.certification_file_path = publicCertPath(req.file.filename);
      header.certification_original_name = req.file.originalname;
    } else if (scoped.remove_certification === "true" || scoped.remove_certification === true) {
      if (report.certification_file_path) removeCertFile(report.certification_file_path);
      header.certification_file_path = null;
      header.certification_original_name = null;
    } else {
      header.certification_file_path = report.certification_file_path;
      header.certification_original_name = report.certification_original_name;
    }

    await report.update(header, { transaction: t });

    await ComplianceFinding.destroy({ where: { report_id: report.id }, transaction: t });
    await ComplianceViolation.destroy({ where: { report_id: report.id }, transaction: t });
    await ComplianceEnforcementAction.destroy({ where: { report_id: report.id }, transaction: t });

    const nested = mapNested(report.id, { findings, violations, enforcement_actions });
    if (nested.findings.length) await ComplianceFinding.bulkCreate(nested.findings, { transaction: t });
    if (nested.violations.length) await ComplianceViolation.bulkCreate(nested.violations, { transaction: t });
    if (nested.enforcement_actions.length) {
      await ComplianceEnforcementAction.bulkCreate(nested.enforcement_actions, { transaction: t });
    }

    await t.commit();
    res.json({ success: true, data: serializeReport(await findReport(report.id)) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const allowed = ["draft", "submitted", "approved"];
    const { status } = req.body;
    if (!allowed.includes(status)) {
      return res.status(422).json({ success: false, message: "Invalid status" });
    }
    const report = await ComplianceReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    await report.update({ status });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = {
  listReports, getReport, createReport, updateReport, updateStatus,
};
