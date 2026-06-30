const sequelize = require("../config/database");
const { ZonalOffice, StateOffice } = require("../models");
const ComplaintsComplianceReport = require("../models/ComplaintsComplianceReport");
const {
  ComplaintSummaryLine, ComplaintStatusLine, ComplianceVisitLine, ReconciliationLine,
} = require("../models/ComplaintsComplianceLines");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);

const complaintsIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
  { model: ComplaintSummaryLine, as: "summary_lines" },
  { model: ComplaintStatusLine, as: "status_lines" },
  { model: ComplianceVisitLine, as: "visit_lines" },
  { model: ReconciliationLine, as: "reconciliation_lines" },
];

const findComplaintsReport = (id) =>
  ComplaintsComplianceReport.findByPk(id, { include: complaintsIncludes });

const generateRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await ComplaintsComplianceReport.count({ transaction: t });
  return `CMP-${year}-${String(count + 1).padStart(5, "0")}`;
};

const saveComplaintsChildren = async (reportId, body, t) => {
  const {
    summary_lines = [], status_lines = [],
    visit_lines = [], reconciliation_lines = [],
  } = body;

  await ComplaintSummaryLine.destroy({ where: { report_id: reportId }, transaction: t });
  await ComplaintStatusLine.destroy({ where: { report_id: reportId }, transaction: t });
  await ComplianceVisitLine.destroy({ where: { report_id: reportId }, transaction: t });
  await ReconciliationLine.destroy({ where: { report_id: reportId }, transaction: t });

  if (summary_lines.length) {
    await ComplaintSummaryLine.bulkCreate(
      summary_lines.map((l) => ({
        report_id: reportId,
        category: l.category,
        complaint_count: Number(l.complaint_count) || 0,
      })),
      { transaction: t }
    );
  }
  if (status_lines.length) {
    await ComplaintStatusLine.bulkCreate(
      status_lines.map((l) => ({
        report_id: reportId,
        status: l.status,
        status_count: Number(l.status_count) || 0,
      })),
      { transaction: t }
    );
  }
  if (visit_lines.length) {
    await ComplianceVisitLine.bulkCreate(
      visit_lines.map((l) => ({
        report_id: reportId,
        facility_visited: l.facility_visited,
        visit_date: l.visit_date || null,
        purpose: l.purpose || null,
        outcome: l.outcome || null,
      })),
      { transaction: t }
    );
  }
  if (reconciliation_lines.length) {
    await ReconciliationLine.bulkCreate(
      reconciliation_lines.map((l) => ({
        report_id: reportId,
        hmo: l.hmo,
        facility: l.facility,
        amount_owed: Number(l.amount_owed) || 0,
        recon_status: l.recon_status || null,
        comment: l.comment || null,
      })),
      { transaction: t }
    );
  }
};

const createReport = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      zone_id, state_id, reporting_year, reporting_month,
      submission_date, submitted_by, status = "draft",
    } = req.body;

    const reference_id = await generateRefId(t);
    const report = await ComplaintsComplianceReport.create({
      reference_id, zone_id, state_id, reporting_year, reporting_month,
      submission_date, submitted_by, status,
    }, { transaction: t });

    await saveComplaintsChildren(report.id, req.body, t);
    await t.commit();
    const full = await findComplaintsReport(report.id);
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

    const list = await ComplaintsComplianceReport.findAll({
      where,
      include: complaintsIncludes,
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
};

const getReport = async (req, res, next) => {
  try {
    const report = await findComplaintsReport(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

const updateReport = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const report = await ComplaintsComplianceReport.findByPk(req.params.id, { transaction: t });
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
    }, { transaction: t });

    await saveComplaintsChildren(report.id, req.body, t);
    await t.commit();
    const full = await findComplaintsReport(report.id);
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
    const report = await ComplaintsComplianceReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Not found" });
    await report.update({ status });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = {
  createReport, listReports, getReport, updateReport, updateStatus,
};
