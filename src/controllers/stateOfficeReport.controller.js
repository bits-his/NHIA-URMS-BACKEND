const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ENROLMENT_DRIVE_TYPES } = require("../utils/enrolmentDriveTypes");
const { ZonalOffice, StateOffice } = require("../models");
const {
  buildStateOfficeListWhere, withCoordinatorTeam, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");
const { canReviewMonthlyReport } = require("../utils/monthlyReportScope");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);

const BENEFICIARY_TABLES = new Set([
  "extra_dependant_reports",
  "hcp_change_reports",
  "hmo_selection_reports",
]);

const tableNameOf = (modelOrInstance) => {
  const model = modelOrInstance.tableName ? modelOrInstance : modelOrInstance.constructor;
  const name = typeof model.getTableName === "function" ? model.getTableName() : model.tableName;
  return typeof name === "string" ? name : name?.tableName;
};

const isBeneficiaryModel = (modelOrInstance) => BENEFICIARY_TABLES.has(tableNameOf(modelOrInstance));

const isCoordinatorRole = (role) => /(^|-)(state|zonal)-coordinator$/.test(String(role || ""));

const patchBeneficiaryStatus = async (req, report) => {
  const { status, review_note: reviewNote, action } = req.body;
  const role = String(req.user?.role || "");
  const reviewer = role === "admin" || isCoordinatorRole(role) || await canReviewMonthlyReport(role);
  const note = reviewNote && String(reviewNote).trim() ? String(reviewNote).trim() : "";
  const reviewerName = req.user?.name || req.user?.staff_id || "Reviewer";

  if (action === "endorse" || action === "return") {
    if (!reviewer) {
      const err = new Error("Only a state coordinator can endorse or return this report");
      err.status = 403;
      throw err;
    }
    if (report.status !== "submitted") {
      const err = new Error("Only reports sent for review can be endorsed or returned");
      err.status = 422;
      throw err;
    }
    if (!note) {
      const err = new Error(action === "endorse"
        ? "A comment is required to endorse"
        : "A comment is required when returning a report");
      err.status = 422;
      throw err;
    }
    await report.update({
      status: "draft",
      endorsed: action === "endorse",
      coordinator_review_note: note,
      coordinator_reviewed_by: reviewerName,
      coordinator_reviewed_at: new Date(),
    });
    return;
  }

  if (action === "final_submit" || status === "approved") {
    if (!report.endorsed) {
      const err = new Error("The state coordinator must endorse this report before final submission");
      err.status = 422;
      throw err;
    }
    await report.update({ status: "approved" });
    return;
  }

  const err = new Error("Send the report for review from the form");
  err.status = 422;
  throw err;
};

const STANDARD_STATUSES = ["draft", "submitted", "approved"];
const PROVIDER_STATUSES = [
  "draft", "awaiting_review", "returned", "endorsed", "submitted", "approved",
];

const patchReportStatus = async (req, report, { providerWorkflow = false } = {}) => {
  if (isBeneficiaryModel(report)) return patchBeneficiaryStatus(req, report);
  const { status, review_note: reviewNote } = req.body;
  const allowed = providerWorkflow ? PROVIDER_STATUSES : STANDARD_STATUSES;

  if (!allowed.includes(status)) {
    const err = new Error("Invalid status");
    err.status = 422;
    throw err;
  }
  const role = String(req.user?.role || "");
  const isCoordinator = /(^|-)(state|zonal)-coordinator$/.test(role);
  const isReportingOfficer = role === "reporting-officer" || role.endsWith("-reporting-officer");
  const reviewerName = req.user?.name || req.user?.staff_id || "Reviewer";
  const note = reviewNote && String(reviewNote).trim() ? String(reviewNote).trim() : null;

  if (providerWorkflow) {
    const current = report.status;
    if (isCoordinator) {
      if (current === "awaiting_review") {
        if (status !== "endorsed" && status !== "returned") {
          const err = new Error("Coordinators may endorse or return reports awaiting review");
          err.status = 422;
          throw err;
        }
        if (status === "returned" && !note) {
          const err = new Error("A comment is required when returning a report");
          err.status = 422;
          throw err;
        }
      } else if (current === "submitted") {
        if (status !== "approved" && status !== "draft") {
          const err = new Error("Coordinators may approve or return submitted reports");
          err.status = 422;
          throw err;
        }
        if (status === "draft" && !note) {
          const err = new Error("A comment is required when returning a report");
          err.status = 422;
          throw err;
        }
      } else {
        const err = new Error("Only reports awaiting review (or submitted) can be actioned by a coordinator");
        err.status = 422;
        throw err;
      }
      await report.update({
        status,
        coordinator_reviewed_by: reviewerName,
        coordinator_reviewed_at: new Date(),
        coordinator_review_note: note || (status === "endorsed" || status === "approved" ? null : report.coordinator_review_note),
      });
      return;
    }
    // Officer transitions
    if (status === "awaiting_review" && !["draft", "returned"].includes(current)) {
      const err = new Error("Only draft or returned reports can be sent for review");
      err.status = 422;
      throw err;
    }
    if (status === "submitted" && current !== "endorsed") {
      const err = new Error("Report must be endorsed by the State Coordinator before submission");
      err.status = 422;
      throw err;
    }
    if (status === "draft" && !["draft", "returned"].includes(current)) {
      const err = new Error("Cannot move this report back to draft from the current status");
      err.status = 422;
      throw err;
    }
    if (["endorsed", "returned", "approved"].includes(status) && !isCoordinator) {
      const err = new Error("Only a State Coordinator can endorse or return this report");
      err.status = 422;
      throw err;
    }
    await report.update({ status });
    return;
  }

  if (isCoordinator) {
    if (report.status !== "submitted") {
      const err = new Error("Only submitted reports can be approved or returned from the review queue");
      err.status = 422;
      throw err;
    }
    // submitted = save review notes; draft = return for correction; approved = endorse
    if (status !== "approved" && status !== "draft" && status !== "submitted") {
      const err = new Error("Coordinators may save review, return for correction, or endorse");
      err.status = 422;
      throw err;
    }
    if (status === "draft" && !note) {
      const err = new Error("A comment is required when returning a report");
      err.status = 422;
      throw err;
    }
  } else if (isReportingOfficer) {
    // Officers submit (or keep draft); they cannot approve or return others' work
    if (status !== "draft" && status !== "submitted") {
      const err = new Error("Reporting officers may only save drafts or submit reports");
      err.status = 422;
      throw err;
    }
  } else if (status === "approved" && role !== "admin") {
    const err = new Error("Only coordinators may approve reports");
    err.status = 403;
    throw err;
  }
  await report.update({
    status,
    ...(isCoordinator ? {
      coordinator_reviewed_by: reviewerName,
      coordinator_reviewed_at: new Date(),
      coordinator_review_note: note
        ? note
        : (status === "approved" ? null : report.coordinator_review_note),
    } : {}),
  });
};

const makeReportController = (ReportModel, LineModel, refPrefix, mapLine, headerExtras = {}, fixed = {}, options = {}) => {
  const providerWorkflow = !!options.providerWorkflow;
  const afterPersist = typeof options.afterPersist === "function" ? options.afterPersist : null;
  /**
   * headerExtras: { field: (rawValue) => storedValue } for report-specific header columns.
   * fixed: column values stamped on create and required on every read/write (shared-table variants).
   */
  const matchesFixed = (report) =>
    !!report && Object.entries(fixed).every(([k, v]) => report[k] === v);
  const pickHeaderExtras = (body) => Object.fromEntries(
    Object.entries(headerExtras)
      .filter(([k]) => body[k] !== undefined)
      .map(([k, fn]) => [k, fn(body[k])]),
  );

  const generateRefId = async (t) => {
    const year = new Date().getFullYear();
    const count = await ReportModel.count({ transaction: t });
    return `${refPrefix}-${year}-${String(count + 1).padStart(5, "0")}`;
  };

  const findReport = (id) =>
    ReportModel.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
        { model: LineModel,   as: "lines" },
      ],
    });

  const createReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status = "draft", lines = [],
      } = scoped;

      if (isBeneficiaryModel(ReportModel) && status === "approved") {
        await t.rollback();
        return res.status(422).json({
          success: false,
          message: "Send the report for review. Final approval follows the state coordinator's endorsement.",
        });
      }

      const reference_id = await generateRefId(t);
      const quarter = quarterFromMonth(reporting_month);

      const report = await ReportModel.create({
        reference_id, zone_id, state_id,
        reporting_year, reporting_month,
        submission_date, submitted_by, status,
        ...pickHeaderExtras(scoped),
        ...fixed,
      }, { transaction: t });

      if (lines.length > 0) {
        const rows = lines.map((line) => mapLine(line, report.id, quarter));
        await LineModel.bulkCreate(rows, { transaction: t });
      }

      await t.commit();
      const full = await findReport(report.id);
      if (afterPersist) {
        afterPersist(full, { action: "create", userId: req.user?.id, fromStatus: null }).catch(() => {});
      }
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      const where = {
        ...(await withCoordinatorTeam(
          req.user,
          await buildStateOfficeListWhere(req.user, req.query, ReportModel),
          ReportModel,
        )),
        ...fixed,
      };
      // Only apply when the model still has activity_module (legacy shared tables).
      if (req.query.activity_module && ReportModel.rawAttributes?.activity_module) {
        const mod = String(req.query.activity_module);
        where.activity_module = mod === "engagement-coordination"
          ? { [Op.or]: [mod, null] }
          : mod;
      }

      const list = await ReportModel.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: LineModel,   as: "lines" },
        ],
        order: [["created_at", "DESC"]],
      });
      res.json({ success: true, data: list });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const found = await findReport(req.params.id);
      const report = matchesFixed(found) ? found : null;
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const report = await ReportModel.findByPk(req.params.id, { transaction: t });
      if (!matchesFixed(report)) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        await t.rollback();
        return res.status(access.status).json({ success: false, message: access.message });
      }

      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status, lines = [],
      } = scoped;

      if (providerWorkflow) {
        // Endorsed: officer may only submit (no content edits / no revert to draft).
        // Draft & returned remain fully editable. Awaiting review is locked.
        if (report.status === "endorsed") {
          if (status !== "submitted") {
            await t.rollback();
            return res.status(422).json({
              success: false,
              message: "Endorsed reports can only be submitted. Ask the coordinator to return it if changes are needed.",
            });
          }
        } else if (!["draft", "returned"].includes(report.status)) {
          await t.rollback();
          return res.status(422).json({
            success: false,
            message: "This report cannot be edited in its current status",
          });
        }
      }

      const quarter = quarterFromMonth(reporting_month);
      const beneficiary = isBeneficiaryModel(ReportModel);
      if (beneficiary && status === "approved" && !report.endorsed) {
        await t.rollback();
        return res.status(422).json({
          success: false,
          message: "The state coordinator must endorse this report before final submission.",
        });
      }

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by,
        ...(status && { status }),
        ...(beneficiary && status === "submitted" ? {
          endorsed: false,
          coordinator_review_note: null,
          coordinator_reviewed_by: null,
          coordinator_reviewed_at: null,
        } : {}),
        ...pickHeaderExtras(scoped),
      }, { transaction: t });

      // Content replace only when still editable (not a pure submit of endorsed)
      if (!providerWorkflow || report.status !== "endorsed") {
        await LineModel.destroy({ where: { report_id: report.id }, transaction: t });

        if (lines.length > 0) {
          const rows = lines.map((line) => mapLine(line, report.id, quarter));
          await LineModel.bulkCreate(rows, { transaction: t });
        }
      }

      await t.commit();
      const full = await findReport(report.id);
      if (afterPersist) {
        afterPersist(full, { action: "update", userId: req.user?.id }).catch(() => {});
      }
      res.json({ success: true, data: full });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const found = await ReportModel.findByPk(req.params.id);
      const report = matchesFixed(found) ? found : null;
      if (!report) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      const fromStatus = report.status;
      await patchReportStatus(req, report, { providerWorkflow });
      if (afterPersist) {
        const full = await findReport(report.id);
        afterPersist(full, {
          action: req.body?.action || req.body?.status || "status",
          userId: req.user?.id,
          fromStatus,
          note: req.body?.review_note || null,
        }).catch(() => {});
      }
      res.json({ success: true, data: report });
    } catch (err) {
      if (err.status === 422) {
        return res.status(422).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const {
  EnrolmentReport, EnrolmentReportLine,
  MigrationReport, MigrationReportLine,
  CemoncReport, CemoncReportLine,
  IgrReport, IgrReportLine,
  SshiaFinancialReport, SshiaFinancialReportLine,
  ExpenditureProfileReport, ExpenditureProfileReportLine,
  WeeklyActionableReport, WeeklyActionableReportLine,
  ContractedServicesReport, ContractedServicesReportLine,
  IctSupportReport, IctSupportReportLine,
  AdhocAssignmentReport, AdhocAssignmentReportLine,
  MonthlyEnrolleeRegister,
  EtmcTmcActionPointRegister, EtmcTmcActionPointLine,
} = require("../models");
const { dualWriteEnrolment } = require("../services/redesign/enrolmentDualWrite");

const enrolment = makeReportController(
  EnrolmentReport, EnrolmentReportLine, "ENR",
  (line, reportId, quarter) => ({
    report_id: reportId,
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
    activity_budget: line.activity_budget != null && line.activity_budget !== "" ? Number(line.activity_budget) : null,
    approved_amount: line.approved_amount != null && line.approved_amount !== "" ? Number(line.approved_amount) : null,
    enrolment_count: Number(line.enrolment_count) || 0,
    enrollees_validated: line.enrollees_validated != null && line.enrollees_validated !== "" ? Number(line.enrollees_validated) : null,
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
    program_details: line.program_details && typeof line.program_details === "object"
      ? line.program_details
      : (line.program_details ? (() => { try { return JSON.parse(line.program_details); } catch { return null; } })() : null),
    quarter,
  }),
  {},
  {},
  { afterPersist: dualWriteEnrolment },
);

const migration = makeReportController(
  MigrationReport, MigrationReportLine, "MIG",
  (line, reportId, quarter) => ({
    report_id: reportId,
    request_type: line.request_type,
    request_count: Number(line.request_count) || 0,
    quarter,
  })
);

const cemonc = makeReportController(
  CemoncReport, CemoncReportLine, "CEM",
  (line, reportId) => ({
    report_id: reportId,
    intervention_type: line.intervention_type,
    facility_name: line.facility_name,
    beneficiaries: Number(line.beneficiaries) || 0,
  })
);

const {
  AccreditationReport, AccreditationReportLine,
  StakeholderReport, StakeholderReportLine,
  EnrolmentDriveReport, EnrolmentDriveReportLine,
  HmoSelectionReport, HmoSelectionReportLine,
  ChallengesReport, ChallengesReportLine,
  ExtraDependantReport, ExtraDependantReportLine,
  HcpChangeReport, HcpChangeReportLine,
} = require("../models");

const optNum = (v) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const strArray = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

const mapAccreditationLine = (line, reportId) => {
  if (
    line.engagement_category
    || line.activity_date
    || line.activity_status
    || line.provider_management_id
    || line.related_programme
    || line.form_type
  ) {
    const payload = { ...line };
    delete payload.indicator;
    delete payload.primary_count;
    delete payload.secondary_count;
    delete payload.supportingFiles;
    const covered = optNum(line.facilities_covered ?? line.stakeholders_engaged) || 0;
    const planned = optNum(line.facilities_planned ?? line.planned_target_stakeholders) || 0;
    payload.facilities_covered = covered;
    payload.facilities_planned = planned;
    // Linked display fields share the covered count (no duplicate entry)
    if (payload.form_type === "accreditation" || payload.engagement_category === "Accreditation") {
      payload.facilities_accredited = covered;
      if (payload.related_programme === "BHCPF") payload.phcs_accredited = covered;
    }
    if (payload.form_type === "reaccreditation" || payload.engagement_category === "Re-accreditation") {
      payload.facilities_reaccredited = covered;
      if (payload.related_programme === "BHCPF") payload.phcs_reaccredited = covered;
    }
    if (payload.bhcpf_activity_type === "Accreditation") payload.phcs_accredited = covered;
    if (payload.bhcpf_activity_type === "Reaccreditation") payload.phcs_reaccredited = covered;
    return {
      report_id: reportId,
      indicator: "accreditation_applications",
      primary_count: covered,
      secondary_count: planned,
      activity_template: payload,
    };
  }
  return {
    report_id: reportId,
    indicator: line.indicator,
    primary_count: Number(line.primary_count) || 0,
    secondary_count: Number(line.secondary_count) || 0,
  };
};

const {
  ProviderAccreditationReport, ProviderAccreditationReportLine,
  ProviderReaccreditationReport, ProviderReaccreditationReportLine,
  ProviderMedicalAuditReport, ProviderMedicalAuditReportLine,
  ProviderQaInspectionReport, ProviderQaInspectionReportLine,
} = require("../models/providerManagement");

const makeProviderUpload = (ReportModel, LineModel) => async (req, res, next) => {
  try {
    const report = await ReportModel.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const line = await LineModel.findOne({
      where: { id: req.params.lineId, report_id: report.id },
    });
    if (!line) return res.status(404).json({ success: false, message: "Line not found" });
    const files = req.files || [];
    if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
    const added = files.map((f) => ({ name: f.originalname, path: `/uploads/beneficiary/${f.filename}` }));
    const tpl = line.activity_template && typeof line.activity_template === "object"
      ? { ...line.activity_template }
      : {};
    const existing = Array.isArray(tpl.supporting_documents) ? tpl.supporting_documents : [];
    tpl.supporting_documents = [...existing, ...added];
    await line.update({ activity_template: tpl });
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
};

/** Dedicated tables — one physical table family per Provider Management form */
const providerAccreditation = makeReportController(
  ProviderAccreditationReport, ProviderAccreditationReportLine, "PACC",
  mapAccreditationLine,
  { planned_activities: optNum },
  {},
  { providerWorkflow: true },
);
providerAccreditation.uploadLineFiles = makeProviderUpload(
  ProviderAccreditationReport, ProviderAccreditationReportLine,
);

const providerReaccreditation = makeReportController(
  ProviderReaccreditationReport, ProviderReaccreditationReportLine, "PREC",
  mapAccreditationLine,
  { planned_activities: optNum },
  {},
  { providerWorkflow: true },
);
providerReaccreditation.uploadLineFiles = makeProviderUpload(
  ProviderReaccreditationReport, ProviderReaccreditationReportLine,
);

const providerMedicalAudits = makeReportController(
  ProviderMedicalAuditReport, ProviderMedicalAuditReportLine, "PMED",
  mapAccreditationLine,
  { planned_activities: optNum },
  {},
  { providerWorkflow: true },
);
providerMedicalAudits.uploadLineFiles = makeProviderUpload(
  ProviderMedicalAuditReport, ProviderMedicalAuditReportLine,
);

const providerQaInspections = makeReportController(
  ProviderQaInspectionReport, ProviderQaInspectionReportLine, "PQA",
  mapAccreditationLine,
  { planned_activities: optNum },
  {},
  { providerWorkflow: true },
);
providerQaInspections.uploadLineFiles = makeProviderUpload(
  ProviderQaInspectionReport, ProviderQaInspectionReportLine,
);

/** @deprecated alias — same as providerAccreditation (dedicated table) */
const accreditation = providerAccreditation;

const stakeholder = makeReportController(
  StakeholderReport, StakeholderReportLine, "STK",
  (line, reportId) => ({
    report_id: reportId,
    engagement_code: line.engagement_code || null,
    activity_date: line.activity_date || null,
    engagement_category: line.engagement_category || line.activity || "Stakeholder Engagement",
    stakeholder_categories: strArray(line.stakeholder_categories),
    stakeholder_names: line.stakeholder_names || null,
    specific_activity: line.specific_activity || null,
    engagement_purpose: line.engagement_purpose || null,
    funding_option: line.funding_option || null,
    activity_budget: optNum(line.activity_budget),
    approved_amount: optNum(line.approved_amount),
    planned_target_audience: optNum(line.planned_target_audience),
    target_audience_reached: strArray(line.target_audience_reached),
    location_category: line.location_category || null,
    location_name: line.location_name || line.location || null,
    programs_supported: strArray(line.programs_supported),
    activity_details: line.activity_details || null,
    planned_target_stakeholders: optNum(line.planned_target_stakeholders),
    stakeholders_engaged: optNum(line.stakeholders_engaged ?? line.audience_size),
    follow_up_required: line.follow_up_required || null,
    follow_up_date: line.follow_up_date || null,
    follow_up_visits: optNum(line.follow_up_visits),
    follow_up_details: line.follow_up_details && typeof line.follow_up_details === "object"
      ? line.follow_up_details
      : null,
    location_specify: line.location_specify || null,
    supporting_evidence_types: strArray(line.supporting_evidence_types),
    supporting_documents: Array.isArray(line.supporting_documents)
      ? line.supporting_documents
          .filter((d) => d && typeof d === "object" && d.path)
          .map((d) => ({ name: d.name || "Document", path: d.path }))
      : [],
    outcome_category: line.outcome_category
      || (Array.isArray(line.outcomes) && line.outcomes[0]?.outcome_category)
      || null,
    specific_outcome: line.specific_outcome
      || line.key_outcomes
      || (Array.isArray(line.outcomes) && line.outcomes[0]?.specific_outcome)
      || null,
    outcomes: Array.isArray(line.outcomes)
      ? line.outcomes
          .filter((o) => o && (o.outcome_category || o.specific_outcome))
          .map((o) => ({
            outcome_category: o.outcome_category || null,
            specific_outcome: o.specific_outcome || null,
          }))
      : [],
    expected_output: line.expected_output || null,
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
    // legacy mirrors for older detail views
    activity: line.engagement_category || line.activity || null,
    audience_size: optNum(line.stakeholders_engaged ?? line.audience_size) || 0,
    organization: line.stakeholder_names || line.organization || null,
    location: line.location_name || line.location || null,
    key_outcomes: line.specific_outcome || line.key_outcomes || null,
  }),
  {
    planned_activities: optNum,
    activity_module: (v) => (v != null && String(v).trim() ? String(v).trim() : null),
  },
  {},
  { providerWorkflow: true },
);

const makeStakeholderLineUpload = async (req, res, next) => {
  try {
    const report = await StakeholderReport.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const line = await StakeholderReportLine.findOne({
      where: { id: req.params.lineId, report_id: report.id },
    });
    if (!line) return res.status(404).json({ success: false, message: "Line not found" });
    const files = req.files || [];
    if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
    const added = files.map((f) => ({ name: f.originalname, path: `/uploads/beneficiary/${f.filename}` }));
    const existing = Array.isArray(line.supporting_documents) ? line.supporting_documents : [];
    await line.update({ supporting_documents: [...existing, ...added] });
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
};
stakeholder.uploadLineFiles = makeStakeholderLineUpload;

const mapEnrolmentDriveLine = (line, reportId) => ({
    report_id: reportId,
    drive_code: line.drive_code || null,
    activity_date: line.activity_date || null,
    activity_category: line.activity_category,
    specific_activity: line.specific_activity || null,
    funding_option: line.funding_option || null,
    activity_budget: optNum(line.activity_budget),
    approved_amount: optNum(line.approved_amount),
    target_audience: strArray(line.target_audience),
    location_category: line.location_category || null,
    location_name: line.location_name || null,
    programs_supported: strArray(line.programs_supported),
    activity_details: line.activity_details || null,
    planned_target_audience: optNum(line.planned_target_audience),
    target_audience_reached: optNum(line.target_audience_reached),
    leads_generated: optNum(line.leads_generated),
    new_enrolments: optNum(line.new_enrolments),
    supporting_documents: Array.isArray(line.supporting_documents)
      ? line.supporting_documents
          .filter((d) => d && typeof d === "object" && d.path)
          .map((d) => ({ name: d.name || "Document", path: d.path }))
      : [],
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
});

const makeEnrolmentDriveLineUpload = (driveType) => async (req, res, next) => {
  try {
    const found = await EnrolmentDriveReport.findByPk(req.params.id);
    const report = found && found.drive_type === driveType ? found : null;
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const line = await EnrolmentDriveReportLine.findOne({
      where: { id: req.params.lineId, report_id: report.id },
    });
    if (!line) return res.status(404).json({ success: false, message: "Line not found" });
    const files = req.files || [];
    if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
    const added = files.map((f) => ({ name: f.originalname, path: `/uploads/beneficiary/${f.filename}` }));
    await line.update({ supporting_documents: [...line.supporting_documents, ...added] });
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
};

/** segment (e.g. "enrolment-drive-advocacy") → controller */
const enrolmentDrives = Object.fromEntries(
  ENROLMENT_DRIVE_TYPES.map((t) => [t.segment, {
    ...makeReportController(
      EnrolmentDriveReport, EnrolmentDriveReportLine, t.prefix, mapEnrolmentDriveLine,
      { planned_activities: optNum }, { drive_type: t.key },
    ),
    uploadLineFiles: makeEnrolmentDriveLineUpload(t.key),
  }]),
);

const hmoSelection = makeReportController(
  HmoSelectionReport, HmoSelectionReportLine, "HMO",
  (line, reportId) => ({
    report_id: reportId,
    mda: line.mda,
    selection_date: line.selection_date || null,
    hmos_in_attendance: line.hmos_in_attendance || (line.hmos_attended != null ? String(line.hmos_attended) : null),
    former_hmo: line.former_hmo || null,
    reason_for_change: line.reason_for_change || null,
    hmos_invited: line.hmos_invited != null && line.hmos_invited !== "" ? Number(line.hmos_invited) : null,
    hmos_attended: line.hmos_attended != null && line.hmos_attended !== "" ? Number(line.hmos_attended) : null,
    compliance_guideline: line.compliance_guideline || null,
    transparent_process: line.transparent_process || null,
    selected_hmo: line.selected_hmo || null,
    evidence_path: line.evidence_path || null,
    evidence_name: line.evidence_name || null,
    report_path: line.report_path || null,
    report_name: line.report_name || null,
    details: line.details && typeof line.details === "object" ? line.details : null,
  })
);

hmoSelection.uploadLineFile = async (req, res, next) => {
  try {
    const report = await HmoSelectionReport.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const line = await HmoSelectionReportLine.findOne({
      where: { id: req.params.lineId, report_id: report.id },
    });
    if (!line) return res.status(404).json({ success: false, message: "Line not found" });
    if (!req.file) return res.status(422).json({ success: false, message: "No file uploaded" });
    const kind = req.body.kind === "report" ? "report" : "evidence";
    const publicPath = `/uploads/beneficiary/${req.file.filename}`;
    if (kind === "report") {
      await line.update({ report_path: publicPath, report_name: req.file.originalname });
    } else {
      await line.update({ evidence_path: publicPath, evidence_name: req.file.originalname });
    }
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
};

const extraDependant = makeReportController(
  ExtraDependantReport, ExtraDependantReportLine, "XDEP",
  (line, reportId) => ({
    report_id: reportId,
    enrollee_name: line.enrollee_name,
    principle_nhia_number: line.principle_nhia_number,
    age: line.age != null && line.age !== "" ? Number(line.age) : null,
    relationship: line.relationship,
    program: line.program || null,
    request_date: line.request_date || null,
    process_end_date: line.process_end_date || null,
    line_status: line.line_status || "pending",
    supporting_documents: Array.isArray(line.supporting_documents)
      ? line.supporting_documents
          .filter((d) => d && typeof d === "object" && (d.path || d.field))
          .map((d) => (d.field
            ? { field: String(d.field), value: d.value == null ? "" : String(d.value) }
            : { name: d.name || "Document", path: d.path }))
      : [],
  })
);

extraDependant.uploadLineFiles = async (req, res, next) => {
  try {
    const report = await ExtraDependantReport.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const line = await ExtraDependantReportLine.findOne({
      where: { id: req.params.lineId, report_id: report.id },
    });
    if (!line) return res.status(404).json({ success: false, message: "Line not found" });
    const files = req.files || [];
    if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
    const existingRaw = line.supporting_documents;
    let existing = existingRaw;
    if (typeof existingRaw === "string") {
      try { existing = JSON.parse(existingRaw); } catch { existing = []; }
    }
    if (!Array.isArray(existing)) existing = [];
    const added = files.map((f) => ({
      name: f.originalname,
      path: `/uploads/beneficiary/${f.filename}`,
    }));
    await line.update({ supporting_documents: [...existing, ...added] });
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
};

const hcpChange = makeReportController(
  HcpChangeReport, HcpChangeReportLine, "HCPC",
  (line, reportId) => ({
    report_id: reportId,
    record_date: line.record_date || null,
    enrollee_name: line.enrollee_name,
    nhia_number: line.nhia_number,
    entity_type: line.entity_type === "hmo" || line.entity_type === "hcp" ? line.entity_type : null,
    current_hcp_hmo: line.current_hcp_hmo || null,
    new_hcp_hmo: line.new_hcp_hmo || null,
    reason_for_transfer: line.reason_for_transfer || null,
    met_criteria: line.met_criteria || null,
    request_channel: line.request_channel || null,
    request_date: line.request_date || null,
    process_end_date: line.process_end_date || null,
    line_status: line.line_status || "pending",
    details: line.details && typeof line.details === "object" ? line.details : null,
    supporting_documents: Array.isArray(line.supporting_documents)
      ? line.supporting_documents
          .filter((d) => d && typeof d === "object" && d.path)
          .map((d) => ({ name: d.name || "Document", path: d.path }))
      : [],
  })
);

hcpChange.uploadLineFiles = async (req, res, next) => {
  try {
    const report = await HcpChangeReport.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const line = await HcpChangeReportLine.findOne({
      where: { id: req.params.lineId, report_id: report.id },
    });
    if (!line) return res.status(404).json({ success: false, message: "Line not found" });
    const files = req.files || [];
    if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
    let existing = line.supporting_documents;
    if (typeof existing === "string") {
      try { existing = JSON.parse(existing); } catch { existing = []; }
    }
    if (!Array.isArray(existing)) existing = [];
    const added = files.map((f) => ({
      name: f.originalname,
      path: `/uploads/beneficiary/${f.filename}`,
    }));
    await line.update({ supporting_documents: [...existing, ...added] });
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
};

const makeTextReportController = (ReportModel, refPrefix, textFields = []) => {
  const generateRefId = async (t) => {
    const year = new Date().getFullYear();
    const count = await ReportModel.count({ transaction: t });
    return `${refPrefix}-${year}-${String(count + 1).padStart(5, "0")}`;
  };

  const findReport = (id) =>
    ReportModel.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
      ],
    });

  const pickText = (body) => {
    const out = {};
    textFields.forEach((f) => { out[f] = body[f] ?? null; });
    return out;
  };

  const createReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status = "draft",
      } = scoped;

      const reference_id = await generateRefId(t);
      const report = await ReportModel.create({
        reference_id, zone_id, state_id,
        reporting_year, reporting_month,
        submission_date, submitted_by, status,
        ...pickText(scoped),
      }, { transaction: t });

      await t.commit();
      const full = await findReport(report.id);
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      const where = await withCoordinatorTeam(
        req.user,
        await buildStateOfficeListWhere(req.user, req.query, ReportModel),
        ReportModel,
      );

      const list = await ReportModel.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
        ],
        order: [["created_at", "DESC"]],
      });
      res.json({ success: true, data: list });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const report = await findReport(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const report = await ReportModel.findByPk(req.params.id, { transaction: t });
      if (!report) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        await t.rollback();
        return res.status(access.status).json({ success: false, message: access.message });
      }

      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status,
      } = scoped;

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by,
        ...(status && { status }),
        ...pickText(scoped),
      }, { transaction: t });

      await t.commit();
      const full = await findReport(report.id);
      res.json({ success: true, data: full });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await ReportModel.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await patchReportStatus(req, report);
      res.json({ success: true, data: report });
    } catch (err) {
      if (err.status === 422) {
        return res.status(422).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const challenges = makeReportController(
  ChallengesReport, ChallengesReportLine, "CHL",
  (line, reportId) => ({
    report_id: reportId,
    challenge_code: line.challenge_code || null,
    challenge_category: line.challenge_category,
    specific_challenge: line.specific_challenge || null,
    challenge_details: line.challenge_details || null,
    related_activity: line.related_activity || null,
    related_program: line.related_program || null,
    severity: line.severity || null,
    impact: line.impact || null,
    support_required: line.support_required || null,
    support_context: line.support_context || null,
    key_recommendation: line.key_recommendation || null,
    responsible_department: line.responsible_department || null,
    status: line.status || null,
    remarks: line.remarks || null,
  })
);
const igr = makeReportController(
  IgrReport, IgrReportLine, "IGR",
  (line, reportId, quarter) => ({
    report_id: reportId,
    entry_date: line.entry_date,
    service_type: line.service_type,
    principal_name: line.principal_name,
    receipt_no: line.receipt_no,
    bill_rrr_no: line.bill_rrr_no,
    nin_charge: Number(line.nin_charge) || 0,
    amount: Number(line.amount) || 0,
    quarter,
  })
);

const sshiaFinancial = makeReportController(
  SshiaFinancialReport, SshiaFinancialReportLine, "SSHIA",
  (line, reportId, quarter) => {
    const A = Number(line.opening_balance) || 0;
    const B = Number(line.receipts) || 0;
    const D = Number(line.actual_expenditure) || 0;
    const C = Number(line.total_budget) || (A + B);
    const E = Number(line.balance) || (C - D);
    const F = D !== 0 ? (C / D) * 100 : 0;
    return {
      report_id: reportId,
      sub_head: line.sub_head,
      opening_balance: A,
      receipts: B,
      total_budget: C,
      actual_expenditure: D,
      balance: E,
      variance_pct: F,
      quarter,
    };
  }
);

const expenditureProfile = makeReportController(
  ExpenditureProfileReport, ExpenditureProfileReportLine, "EXPND",
  (line, reportId, quarter) => ({
    report_id: reportId,
    sub_head: line.sub_head,
    amount: Number(line.amount) || 0,
    quarter,
  })
);

// ── Weekly Actionable ─────────────────────────────────────────────────────────
// Custom controller: stores reporting_week on the header record
const makeWeeklyActionableController = () => {
  const refPrefix = "WKA";

  const generateRefId = async (t) => {
    const year = new Date().getFullYear();
    const count = await WeeklyActionableReport.count({ transaction: t });
    return `${refPrefix}-${year}-${String(count + 1).padStart(5, "0")}`;
  };

  const findReport = (id) =>
    WeeklyActionableReport.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
        { model: WeeklyActionableReportLine, as: "lines" },
      ],
    });

  const createReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        reporting_week = 1, submission_date, submitted_by,
        status = "draft", lines = [],
      } = scoped;

      const reference_id = await generateRefId(t);

      const report = await WeeklyActionableReport.create({
        reference_id, zone_id, state_id,
        reporting_year, reporting_month,
        reporting_week: Number(reporting_week) || 1,
        submission_date, submitted_by, status,
      }, { transaction: t });

      if (lines.length > 0) {
        const rows = lines.map((line) => ({
          report_id:       report.id,
          issue_request:   line.issue_request,
          category:        line.category,
          impact:          line.impact,
          urgency:         line.urgency,
          user_department: line.user_department,
          priority_level:  line.priority_level || null,
          status:          line.status,
        }));
        await WeeklyActionableReportLine.bulkCreate(rows, { transaction: t });
      }

      await t.commit();
      const full = await findReport(report.id);
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      const where = await withCoordinatorTeam(req.user, await buildStateOfficeListWhere(req.user, req.query), WeeklyActionableReport);
      const list = await WeeklyActionableReport.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: WeeklyActionableReportLine, as: "lines" },
        ],
        order: [["created_at", "DESC"]],
      });
      res.json({ success: true, data: list });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const report = await findReport(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const report = await WeeklyActionableReport.findByPk(req.params.id, { transaction: t });
      if (!report) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        await t.rollback();
        return res.status(access.status).json({ success: false, message: access.message });
      }

      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        reporting_week = report.reporting_week,
        submission_date, submitted_by, status, lines = [],
      } = scoped;

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        reporting_week: Number(reporting_week) || 1,
        submission_date, submitted_by,
        ...(status && { status }),
      }, { transaction: t });

      await WeeklyActionableReportLine.destroy({ where: { report_id: report.id }, transaction: t });

      if (lines.length > 0) {
        const rows = lines.map((line) => ({
          report_id:       report.id,
          issue_request:   line.issue_request,
          category:        line.category,
          impact:          line.impact,
          urgency:         line.urgency,
          user_department: line.user_department,
          priority_level:  line.priority_level || null,
          status:          line.status,
        }));
        await WeeklyActionableReportLine.bulkCreate(rows, { transaction: t });
      }

      await t.commit();
      const full = await findReport(report.id);
      res.json({ success: true, data: full });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await WeeklyActionableReport.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await patchReportStatus(req, report);
      res.json({ success: true, data: report });
    } catch (err) {
      if (err.status === 422) {
        return res.status(422).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const weeklyActionable = makeWeeklyActionableController();

const SCHEME_FIELDS = ["self_paying", "ops", "retirees", "constituency", "gifship", "formal_sector"];

function enrolleeCounts(body = {}) {
  const counts = {};
  for (const key of SCHEME_FIELDS) {
    counts[key] = Math.max(0, Number(body[key]) || 0);
  }
  counts.total_lives = SCHEME_FIELDS.reduce((sum, key) => sum + counts[key], 0);
  return counts;
}

function isUniquePeriodError(err) {
  const name = err?.name || "";
  const msg = String(err?.message || err?.original?.sqlMessage || "");
  return name === "SequelizeUniqueConstraintError" || msg.includes("mer_zone_state_period");
}

const makeMonthlyEnrolleeRegisterController = () => {
  const generateRefId = async (t) => {
    const year = new Date().getFullYear();
    const count = await MonthlyEnrolleeRegister.count({ transaction: t });
    return `MER-${year}-${String(count + 1).padStart(5, "0")}`;
  };

  const findReport = (id) =>
    MonthlyEnrolleeRegister.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
      ],
    });

  const createReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status = "draft",
      } = scoped;

      const report = await MonthlyEnrolleeRegister.create({
        reference_id: await generateRefId(t),
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status,
        ...enrolleeCounts(scoped),
      }, { transaction: t });

      await t.commit();
      res.status(201).json({ success: true, data: await findReport(report.id) });
    } catch (err) {
      await t.rollback();
      if (isUniquePeriodError(err)) {
        return res.status(409).json({
          success: false,
          message: "A register already exists for this zone, state, year and month",
        });
      }
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      const where = await withCoordinatorTeam(req.user, await buildStateOfficeListWhere(req.user, req.query), MonthlyEnrolleeRegister);
      const list = await MonthlyEnrolleeRegister.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
        ],
        order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["created_at", "DESC"]],
      });
      res.json({ success: true, data: list });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const report = await findReport(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const report = await MonthlyEnrolleeRegister.findByPk(req.params.id, { transaction: t });
      if (!report) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        await t.rollback();
        return res.status(access.status).json({ success: false, message: access.message });
      }

      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status,
      } = scoped;

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by,
        ...(status && { status }),
        ...enrolleeCounts(scoped),
      }, { transaction: t });

      await t.commit();
      res.json({ success: true, data: await findReport(report.id) });
    } catch (err) {
      await t.rollback();
      if (isUniquePeriodError(err)) {
        return res.status(409).json({
          success: false,
          message: "A register already exists for this zone, state, year and month",
        });
      }
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await MonthlyEnrolleeRegister.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await patchReportStatus(req, report);
      res.json({ success: true, data: report });
    } catch (err) {
      if (err.status === 422) {
        return res.status(422).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const enrolleeRegister = makeMonthlyEnrolleeRegisterController();

const sessionFromMonth = (month) => `Q${Math.ceil((Number(month) || 1) / 3)}`;

const mapEtmcLine = (line, reportId, index) => ({
  report_id: reportId,
  sn: Number(line.sn) || index + 1,
  agenda_item: line.agenda_item || "",
  resolution_id: line.resolution_id || `R${String(index + 1).padStart(2, "0")}`,
  resolutions: line.resolutions || "",
  action_point_id: line.action_point_id || `R${String(index + 1).padStart(2, "0")}-AP01`,
  action_point: line.action_point || "",
  timeline: line.timeline || null,
  responsible_dept: line.responsible_dept || null,
  supporting_dept: line.supporting_dept || null,
  status_update: line.status_update || null,
});

const makeEtmcTmcActionPointController = () => {
  const generateRefId = async (t) => {
    const year = new Date().getFullYear();
    const count = await EtmcTmcActionPointRegister.count({ transaction: t });
    return `ETMC-${year}-${String(count + 1).padStart(5, "0")}`;
  };

  const findReport = (id) =>
    EtmcTmcActionPointRegister.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
        { model: EtmcTmcActionPointLine, as: "lines" },
      ],
      order: [[{ model: EtmcTmcActionPointLine, as: "lines" }, "sn", "ASC"]],
    });

  const createReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        meeting_date, etmc_session, submission_date, submitted_by,
        status = "draft", lines = [],
      } = scoped;

      const report = await EtmcTmcActionPointRegister.create({
        reference_id: await generateRefId(t),
        zone_id, state_id, reporting_year, reporting_month,
        meeting_date: meeting_date || null,
        etmc_session: etmc_session || sessionFromMonth(reporting_month),
        submission_date, submitted_by, status,
      }, { transaction: t });

      if (lines.length > 0) {
        await EtmcTmcActionPointLine.bulkCreate(
          lines.map((line, i) => mapEtmcLine(line, report.id, i)),
          { transaction: t },
        );
      }

      await t.commit();
      res.status(201).json({ success: true, data: await findReport(report.id) });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      const where = await withCoordinatorTeam(req.user, await buildStateOfficeListWhere(req.user, req.query), EtmcTmcActionPointRegister);
      const list = await EtmcTmcActionPointRegister.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone",  attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: EtmcTmcActionPointLine, as: "lines" },
        ],
        order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["created_at", "DESC"]],
      });
      res.json({ success: true, data: list });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const report = await findReport(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const report = await EtmcTmcActionPointRegister.findByPk(req.params.id, { transaction: t });
      if (!report) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        await t.rollback();
        return res.status(access.status).json({ success: false, message: access.message });
      }

      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        meeting_date, etmc_session, submission_date, submitted_by, status, lines = [],
      } = scoped;

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        meeting_date: meeting_date || null,
        etmc_session: etmc_session || sessionFromMonth(reporting_month),
        submission_date, submitted_by,
        ...(status && { status }),
      }, { transaction: t });

      await EtmcTmcActionPointLine.destroy({ where: { report_id: report.id }, transaction: t });
      if (lines.length > 0) {
        await EtmcTmcActionPointLine.bulkCreate(
          lines.map((line, i) => mapEtmcLine(line, report.id, i)),
          { transaction: t },
        );
      }

      await t.commit();
      res.json({ success: true, data: await findReport(report.id) });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await EtmcTmcActionPointRegister.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await patchReportStatus(req, report);
      res.json({ success: true, data: report });
    } catch (err) {
      if (err.status === 422) {
        return res.status(422).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  const uploadDocument = async (req, res, next) => {
    try {
      const report = await EtmcTmcActionPointRegister.findByPk(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      if (!req.file) {
        return res.status(422).json({ success: false, message: "No file uploaded" });
      }
      await report.update({
        source_document_path: `/uploads/etmc/${req.file.filename}`,
        source_document_name: req.file.originalname,
      });
      res.json({ success: true, data: await findReport(report.id) });
    } catch (err) { next(err); }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus, uploadDocument };
};

const etmcTmcActionPoint = makeEtmcTmcActionPointController();

// ── Contracted Services ───────────────────────────────────────────────────────
const contractedServices = makeReportController(
  ContractedServicesReport, ContractedServicesReportLine, "CSR",
  (line, reportId) => ({
    report_id:   reportId,
    service:     line.service,
    month:       Number(line.month) || 1,
    beneficiary: line.beneficiary,
    amount:      Number(line.amount) || 0,
  })
);

const ictSupport = makeReportController(
  IctSupportReport, IctSupportReportLine, "ICT",
  (line, reportId) => ({
    report_id: reportId,
    support_id: line.support_id || null,
    date_reported: line.date_reported || null,
    reported_by: line.reported_by || null,
    support_category: line.support_category || null,
    issue_type: line.issue_type || null,
    description: line.description || null,
    priority: line.priority || null,
    date_resolved: line.date_resolved || null,
    resolution_status: line.resolution_status || null,
    action_taken: line.action_taken || null,
    external_support_required: line.external_support_required || null,
    referred_to: line.referred_to || null,
    remarks: line.remarks || null,
  })
);

const adhocAssignment = makeReportController(
  AdhocAssignmentReport, AdhocAssignmentReportLine, "ASG",
  (line, reportId) => ({
    report_id: reportId,
    assignment_id: line.assignment_id || null,
    date_assigned: line.date_assigned || null,
    assignment_title: line.assignment_title || null,
    assigned_by: line.assigned_by || null,
    assignment_description: line.assignment_description || null,
    expected_output: line.expected_output || null,
    responsible_unit: line.responsible_unit || null,
    supporting_staff: line.supporting_staff || null,
    due_date: line.due_date || null,
    assignment_status: line.assignment_status || null,
    date_completed: line.date_completed || null,
    output_achieved: line.output_achieved || null,
    challenges: line.challenges || null,
    support_required: line.support_required || null,
    evidence: line.evidence || null,
    remarks: line.remarks || null,
  })
);

const complaints = require("./complaintsCompliance.controller");

module.exports = {
  enrolment, migration, cemonc,
  accreditation, providerAccreditation, providerReaccreditation,
  providerMedicalAudits, providerQaInspections,
  stakeholder, enrolmentDrives, hmoSelection, challenges,
  complaints, igr, sshiaFinancial, expenditureProfile,
  weeklyActionable, contractedServices, ictSupport, adhocAssignment,
  enrolleeRegister, etmcTmcActionPoint,
  extraDependant, hcpChange,
};
