const { ZonalOffice, StateOffice, AdminHrReport } = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const REF_PREFIX = {
  "office-meeting": "SOM",
  "etmc-cascading": "ETC",
  "office-accommodation": "OAC",
  "utility-services": "UTL",
  "vehicle-maintenance": "VEH",
  "conflict-infraction": "CIF",
  "enrollee-feedback": "EFS",
};

const makeAdminHrController = (reportType) => {
  const refPrefix = REF_PREFIX[reportType] || "AHR";

  const generateRefId = async () => {
    const year = new Date().getFullYear();
    const count = await AdminHrReport.count({ where: { report_type: reportType } });
    return `${refPrefix}-${year}-${String(count + 1).padStart(5, "0")}`;
  };

  const findReport = (id) =>
    AdminHrReport.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
      ],
    });

  const createReport = async (req, res, next) => {
    try {
      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status = "draft",
        title, payload = {},
      } = scoped;

      const reference_id = await generateRefId();
      const report = await AdminHrReport.create({
        reference_id,
        report_type: reportType,
        zone_id,
        state_id,
        reporting_year,
        reporting_month,
        submission_date,
        submitted_by,
        status,
        title: title || null,
        payload: payload || {},
      });

      const full = await findReport(report.id);
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      const where = await buildStateOfficeListWhere(req.user, req.query);
      where.report_type = reportType;

      const list = await AdminHrReport.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
        ],
        order: [["created_at", "DESC"]],
      });
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  };

  const getReport = async (req, res, next) => {
    try {
      const report = await findReport(req.params.id);
      if (!report || report.report_type !== reportType) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  };

  const updateReport = async (req, res, next) => {
    try {
      const report = await AdminHrReport.findByPk(req.params.id);
      if (!report || report.report_type !== reportType) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }

      const scoped = await applyScopeToBody(req.user, req.body);
      const {
        zone_id, state_id, reporting_year, reporting_month,
        submission_date, submitted_by, status, title, payload,
      } = scoped;

      await report.update({
        zone_id,
        state_id,
        reporting_year,
        reporting_month,
        submission_date,
        submitted_by,
        ...(status && { status }),
        ...(title !== undefined && { title }),
        ...(payload !== undefined && { payload }),
      });

      const full = await findReport(report.id);
      res.json({ success: true, data: full });
    } catch (err) {
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
      const report = await AdminHrReport.findByPk(req.params.id);
      if (!report || report.report_type !== reportType) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await report.update({ status });
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus };
};

module.exports = {
  officeMeeting: makeAdminHrController("office-meeting"),
  etmcCascading: makeAdminHrController("etmc-cascading"),
  officeAccommodation: makeAdminHrController("office-accommodation"),
  utilityServices: makeAdminHrController("utility-services"),
  vehicleMaintenance: makeAdminHrController("vehicle-maintenance"),
  conflictInfraction: makeAdminHrController("conflict-infraction"),
  enrolleeFeedback: makeAdminHrController("enrollee-feedback"),
  REF_PREFIX,
};
