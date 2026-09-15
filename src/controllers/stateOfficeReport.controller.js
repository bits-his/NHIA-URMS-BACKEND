const sequelize = require("../config/database");
const { ZonalOffice, StateOffice } = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);

const makeReportController = (ReportModel, LineModel, refPrefix, mapLine) => {
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

      const reference_id = await generateRefId(t);
      const quarter = quarterFromMonth(reporting_month);

      const report = await ReportModel.create({
        reference_id, zone_id, state_id,
        reporting_year, reporting_month,
        submission_date, submitted_by, status,
      }, { transaction: t });

      if (lines.length > 0) {
        const rows = lines.map((line) => mapLine(line, report.id, quarter));
        await LineModel.bulkCreate(rows, { transaction: t });
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
      const where = await buildStateOfficeListWhere(req.user, req.query);

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
        submission_date, submitted_by, status, lines = [],
      } = scoped;

      const quarter = quarterFromMonth(reporting_month);

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by,
        ...(status && { status }),
      }, { transaction: t });

      await LineModel.destroy({ where: { report_id: report.id }, transaction: t });

      if (lines.length > 0) {
        const rows = lines.map((line) => mapLine(line, report.id, quarter));
        await LineModel.bulkCreate(rows, { transaction: t });
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
      const allowed = ["draft", "submitted", "approved"];
      const { status } = req.body;
      if (!allowed.includes(status)) {
        return res.status(422).json({ success: false, message: "Invalid status" });
      }
      const report = await ReportModel.findByPk(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await report.update({ status });
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
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
} = require("../models");

const enrolment = makeReportController(
  EnrolmentReport, EnrolmentReportLine, "ENR",
  (line, reportId, quarter) => ({
    report_id: reportId,
    category: line.category,
    enrolment_count: Number(line.enrolment_count) || 0,
    quarter,
  })
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
  HmoSelectionReport, HmoSelectionReportLine,
  ChallengesReport,
} = require("../models");

const accreditation = makeReportController(
  AccreditationReport, AccreditationReportLine, "ACC",
  (line, reportId) => ({
    report_id: reportId,
    indicator: line.indicator,
    primary_count: Number(line.primary_count) || 0,
    secondary_count: Number(line.secondary_count) || 0,
  })
);

const stakeholder = makeReportController(
  StakeholderReport, StakeholderReportLine, "STK",
  (line, reportId) => ({
    report_id: reportId,
    activity: line.activity,
    audience_size: Number(line.audience_size) || 0,
    organization: line.organization || null,
    location: line.location || null,
    activity_date: line.activity_date || null,
    key_outcomes: line.key_outcomes || null,
  })
);

const hmoSelection = makeReportController(
  HmoSelectionReport, HmoSelectionReportLine, "HMO",
  (line, reportId) => ({
    report_id: reportId,
    mda: line.mda,
    selection_date: line.selection_date || null,
    hmos_in_attendance: line.hmos_in_attendance || null,
  })
);

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
      const where = await buildStateOfficeListWhere(req.user, req.query);

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
      const allowed = ["draft", "submitted", "approved"];
      const { status } = req.body;
      if (!allowed.includes(status)) {
        return res.status(422).json({ success: false, message: "Invalid status" });
      }
      const report = await ReportModel.findByPk(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await report.update({ status });
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const challenges = makeTextReportController(
  ChallengesReport, "CHL", ["challenges", "recommendations"]
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
      const where = await buildStateOfficeListWhere(req.user, req.query);
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
      const allowed = ["draft", "submitted", "approved"];
      const { status } = req.body;
      if (!allowed.includes(status)) {
        return res.status(422).json({ success: false, message: "Invalid status" });
      }
      const report = await WeeklyActionableReport.findByPk(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await report.update({ status });
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const weeklyActionable = makeWeeklyActionableController();

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
  accreditation, stakeholder, hmoSelection, challenges,
  complaints, igr, sshiaFinancial, expenditureProfile,
  weeklyActionable, contractedServices, ictSupport, adhocAssignment,
};
