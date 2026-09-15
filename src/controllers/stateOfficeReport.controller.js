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
  MonthlyEnrolleeRegister,
  EtmcTmcActionPointRegister, EtmcTmcActionPointLine,
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
  ExtraDependantReport, ExtraDependantReportLine,
  HcpChangeReport, HcpChangeReportLine,
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
          .filter((d) => d && typeof d === "object" && d.path)
          .map((d) => ({ name: d.name || "Document", path: d.path }))
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
    current_hcp_hmo: line.current_hcp_hmo || null,
    new_hcp_hmo: line.new_hcp_hmo || null,
    reason_for_transfer: line.reason_for_transfer || null,
    met_criteria: line.met_criteria || null,
    request_channel: line.request_channel || null,
    request_date: line.request_date || null,
    process_end_date: line.process_end_date || null,
    line_status: line.line_status || "pending",
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
      const where = await buildStateOfficeListWhere(req.user, req.query);
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
      const allowed = ["draft", "submitted", "approved"];
      const { status } = req.body;
      if (!allowed.includes(status)) {
        return res.status(422).json({ success: false, message: "Invalid status" });
      }
      const report = await MonthlyEnrolleeRegister.findByPk(req.params.id);
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
      const where = await buildStateOfficeListWhere(req.user, req.query);
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
      const allowed = ["draft", "submitted", "approved"];
      const { status } = req.body;
      if (!allowed.includes(status)) {
        return res.status(422).json({ success: false, message: "Invalid status" });
      }
      const report = await EtmcTmcActionPointRegister.findByPk(req.params.id);
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await report.update({ status });
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
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

const complaints = require("./complaintsCompliance.controller");

module.exports = {
  enrolment, migration, cemonc,
  accreditation, stakeholder, hmoSelection, challenges,
  complaints, igr, sshiaFinancial, expenditureProfile,
  weeklyActionable, contractedServices, enrolleeRegister, etmcTmcActionPoint,
  extraDependant, hcpChange,
};
