const sequelize = require("../config/database");
const {
  ZonalOffice, StateOffice, ComplaintsComplianceReport, ComplaintsComplianceLine,
} = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const geoInclude = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

function groupComplaintLines(report) {
  if (!report) return report;
  const lines = report.lines || [];
  report.summary_lines = lines.filter((line) => line.line_kind === "summary");
  report.status_lines = lines.filter((line) => line.line_kind === "status");
  report.visit_lines = lines.filter((line) => line.line_kind === "visit");
  report.reconciliation_lines = lines.filter((line) => line.line_kind === "reconciliation");
  return report;
}

const findComplaintsReport = async (id) =>
  groupComplaintLines(await ComplaintsComplianceReport.findByPk(id, { include: geoInclude }));

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

  await ComplaintsComplianceLine.destroy({ where: { report_id: reportId }, transaction: t });

  const rows = [
    ...summary_lines.map((l) => ({
      report_id: reportId,
      line_kind: "summary",
      category: l.category,
      complaint_count: Number(l.complaint_count) || 0,
    })),
    ...status_lines.map((l) => ({
      report_id: reportId,
      line_kind: "status",
      status: l.status,
      status_count: Number(l.status_count) || 0,
    })),
    ...visit_lines.map((l) => ({
      report_id: reportId,
      line_kind: "visit",
      facility_visited: l.facility_visited,
      facility_name: l.facility_visited,
      visit_date: l.visit_date || null,
      purpose: l.purpose || null,
      outcome: l.outcome || null,
    })),
    ...reconciliation_lines.map((l) => ({
      report_id: reportId,
      line_kind: "reconciliation",
      hmo: l.hmo,
      facility: l.facility,
      facility_name: l.facility,
      amount_owed: Number(l.amount_owed) || 0,
      amount: Number(l.amount_owed) || 0,
      recon_status: l.recon_status || null,
      comment: l.comment || null,
    })),
  ];
  if (rows.length) await ComplaintsComplianceLine.bulkCreate(rows, { transaction: t });
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
    const report = await ComplaintsComplianceReport.create({
      reference_id, zone_id, state_id, reporting_year, reporting_month,
      submission_date, submitted_by, status,
    }, { transaction: t });

    await saveComplaintsChildren(report.id, scoped, t);
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
    const where = await buildStateOfficeListWhere(req.user, req.query);

    const list = await ComplaintsComplianceReport.findAll({
      where,
      include: geoInclude,
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: list.map(groupComplaintLines) });
  } catch (err) { next(err); }
};

const getReport = async (req, res, next) => {
  try {
    const report = await findComplaintsReport(req.params.id);
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
    const report = await ComplaintsComplianceReport.findByPk(req.params.id, { transaction: t });
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
    }, { transaction: t });

    await saveComplaintsChildren(report.id, scoped, t);
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
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    await report.update({ status });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = {
  createReport, listReports, getReport, updateReport, updateStatus,
};
