const sequelize = require("../config/database");
const { ZonalOffice, StateOffice } = require("../models");

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
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status = "draft", lines = [],
      } = req.body;

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
      const where = {};
      if (req.query.zone_id)  where.zone_id  = req.query.zone_id;
      if (req.query.state_id) where.state_id = req.query.state_id;
      if (req.query.status)   where.status   = req.query.status;
      if (req.query.year)     where.reporting_year  = req.query.year;
      if (req.query.month)    where.reporting_month = req.query.month;

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
      if (!report) return res.status(404).json({ success: false, message: "Not found" });
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

      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status, lines = [],
      } = req.body;

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
      if (!report) return res.status(404).json({ success: false, message: "Not found" });
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
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status = "draft",
      } = req.body;

      const reference_id = await generateRefId(t);
      const report = await ReportModel.create({
        reference_id, zone_id, state_id,
        reporting_year, reporting_month,
        submission_date, submitted_by, status,
        ...pickText(req.body),
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
      const where = {};
      if (req.query.zone_id)  where.zone_id  = req.query.zone_id;
      if (req.query.state_id) where.state_id = req.query.state_id;
      if (req.query.status)   where.status   = req.query.status;
      if (req.query.year)     where.reporting_year  = req.query.year;
      if (req.query.month)    where.reporting_month = req.query.month;

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
      if (!report) return res.status(404).json({ success: false, message: "Not found" });
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

      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status,
      } = req.body;

      await report.update({
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by,
        ...(status && { status }),
        ...pickText(req.body),
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
      if (!report) return res.status(404).json({ success: false, message: "Not found" });
      await report.update({ status });
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

const challenges = makeTextReportController(
  ChallengesReport, "CHL", ["challenges", "recommendations"]
);

const complaints = require("./complaintsCompliance.controller");

module.exports = {
  enrolment, migration, cemonc,
  accreditation, stakeholder, hmoSelection, challenges,
  complaints,
};
