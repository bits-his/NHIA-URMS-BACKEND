/**
 * Vehicle Maintenance pack — rebuild-compatible CRUD.
 * Accepts legacy zone_id / state_id body keys (mapped to zonal_code / state_code).
 */
const { ZonalOffice, StateOffice, VehicleMaintenanceReport } = require("../models");
const {
  buildStateOfficeListWhere,
  withCoordinatorTeam,
  assertRecordAccess,
  applyScopeToBody,
  isReportingOfficerRole,
  resolveSubmittedBy,
} = require("../utils/stateOfficeScope");

const REPORT_TYPE = "vehicle-maintenance";
const REF_PREFIX = "VEH";

function normalizeRows(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.map((row) => ({
    vehicleModel: String(row.vehicleModel || "").trim(),
    chassisNumber: String(row.chassisNumber || "").trim().toUpperCase(),
    maintenanceType: String(row.maintenanceType || "").trim(),
    problemReported: String(row.problemReported || "").trim(),
    maintenanceDate: row.maintenanceDate ? String(row.maintenanceDate).slice(0, 10) : "",
    nextServiceDate: row.nextServiceDate ? String(row.nextServiceDate).slice(0, 10) : "",
    vehicleStatus: String(row.vehicleStatus || "").trim(),
    remarks: String(row.remarks || "").trim(),
  }));
}

function validateRows(rows, { requireComplete = false } = {}) {
  if (!rows.length) return "Add at least one maintenance entry";
  const filled = rows.filter((r) =>
    r.vehicleModel || r.chassisNumber || r.maintenanceType || r.problemReported
    || r.maintenanceDate || r.nextServiceDate || r.vehicleStatus || r.remarks);
  if (!filled.length) return "Add at least one maintenance entry";

  for (let i = 0; i < filled.length; i += 1) {
    const row = filled[i];
    const label = `Row ${i + 1}`;
    if (requireComplete) {
      if (!row.chassisNumber) return `${label}: Chassis Number is required`;
      if (!row.maintenanceType) return `${label}: Maintenance Type is required`;
      if (!row.maintenanceDate) return `${label}: Maintenance Date is required`;
      if (!row.vehicleStatus) return `${label}: Vehicle Status is required`;
    }
    if (row.maintenanceDate && Number.isNaN(Date.parse(row.maintenanceDate))) {
      return `${label}: Maintenance Date must be a valid date`;
    }
    if (row.nextServiceDate) {
      if (Number.isNaN(Date.parse(row.nextServiceDate))) {
        return `${label}: Next Service Date must be a valid date`;
      }
      if (row.maintenanceDate && row.nextServiceDate < row.maintenanceDate) {
        return `${label}: Next Service Date must be on or after Maintenance Date`;
      }
    }
  }
  return null;
}

function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  return {
    ...p,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    report_type: REPORT_TYPE,
    zone: p.zone
      ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
      : undefined,
    state: p.state
      ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
      : undefined,
  };
}

const findReport = (id) =>
  VehicleMaintenanceReport.findByPk(id, {
    include: [
      { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
      { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
    ],
  });

async function generateRefId() {
  const year = new Date().getFullYear();
  const count = await VehicleMaintenanceReport.count();
  return `${REF_PREFIX}-${year}-${String(count + 1).padStart(5, "0")}`;
}

function geoFromBody(body) {
  return {
    zonal_code: body.zonal_code || body.zone_id || null,
    state_code: body.state_code || body.state_id || null,
  };
}

const createReport = async (req, res, next) => {
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const geo = geoFromBody(scoped);
    if (!geo.zonal_code || !geo.state_code) {
      return res.status(422).json({ success: false, message: "Zone and state are required" });
    }
    const state = await StateOffice.findByPk(geo.state_code);
    if (!state || String(state.zonal_code) !== String(geo.zonal_code)) {
      return res.status(422).json({ success: false, message: "Select a valid state for the zone" });
    }

    const rows = normalizeRows(scoped.payload || {});
    const status = scoped.status || "draft";
    const err = validateRows(rows, { requireComplete: status === "submitted" || status === "approved" });
    if (err) return res.status(422).json({ success: false, message: err });

    const title = scoped.title
      || rows.find((r) => r.vehicleModel)?.vehicleModel
      || rows.find((r) => r.maintenanceType)?.maintenanceType
      || "Vehicle maintenance";

    const report = await VehicleMaintenanceReport.create({
      reference_id: await generateRefId(),
      zonal_code: geo.zonal_code,
      state_code: geo.state_code,
      reporting_year: Number(scoped.reporting_year),
      reporting_month: Number(scoped.reporting_month),
      submission_date: scoped.submission_date || null,
      submitted_by: resolveSubmittedBy(req.user, scoped.submitted_by),
      created_by_user_id: req.user?.id || null,
      status,
      title,
      payload: { rows },
    });

    const full = await findReport(report.id);
    res.status(201).json({ success: true, data: mapReport(full) });
  } catch (err) {
    next(err);
  }
};

const listReports = async (req, res, next) => {
  try {
    // Pass null Model so reporting officers are not name-filtered here;
    // ownership uses created_by_user_id below.
    let where = await buildStateOfficeListWhere(req.user, req.query, null);
    if (isReportingOfficerRole(req.user?.role)) {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      where.created_by_user_id = req.user.id;
    } else {
      where = await withCoordinatorTeam(req.user, where, VehicleMaintenanceReport);
    }

    // buildStateOfficeListWhere may set zone_id/state_id — prefer code columns
    if (where.zone_id && !where.zonal_code) {
      where.zonal_code = where.zone_id;
      delete where.zone_id;
    }
    if (where.state_id && !where.state_code) {
      where.state_code = where.state_id;
      delete where.state_id;
    }

    const list = await VehicleMaintenanceReport.findAll({
      where,
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
      ],
      order: [["created_at", "DESC"]],
    });

    let data = list.map(mapReport);

    const typeFilter = String(req.query.maintenance_type || "").trim();
    const vehicleStatusFilter = String(req.query.vehicle_status || "").trim();
    if (typeFilter || vehicleStatusFilter) {
      data = data.filter((report) => {
        const rows = Array.isArray(report.payload?.rows) ? report.payload.rows : [];
        return rows.some((row) => {
          if (typeFilter && String(row.maintenanceType || "") !== typeFilter) return false;
          if (vehicleStatusFilter && String(row.vehicleStatus || "") !== vehicleStatusFilter) return false;
          return true;
        });
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getReport = async (req, res, next) => {
  try {
    const report = await findReport(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Not found" });
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    res.json({ success: true, data: mapReport(report) });
  } catch (err) {
    next(err);
  }
};

const updateReport = async (req, res, next) => {
  try {
    const report = await VehicleMaintenanceReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Not found" });
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const scoped = await applyScopeToBody(req.user, req.body);
    const geo = geoFromBody(scoped);
    const zonal_code = geo.zonal_code || report.zonal_code;
    const state_code = geo.state_code || report.state_code;
    const state = await StateOffice.findByPk(state_code);
    if (!state || String(state.zonal_code) !== String(zonal_code)) {
      return res.status(422).json({ success: false, message: "Select a valid state for the zone" });
    }

    const rows = scoped.payload !== undefined
      ? normalizeRows(scoped.payload || {})
      : normalizeRows(report.payload || {});
    const status = scoped.status || report.status;
    const err = validateRows(rows, { requireComplete: status === "submitted" || status === "approved" });
    if (err) return res.status(422).json({ success: false, message: err });

    const title = scoped.title !== undefined
      ? scoped.title
      : (rows.find((r) => r.vehicleModel)?.vehicleModel
        || rows.find((r) => r.maintenanceType)?.maintenanceType
        || report.title);

    await report.update({
      zonal_code,
      state_code,
      reporting_year: Number(scoped.reporting_year ?? report.reporting_year),
      reporting_month: Number(scoped.reporting_month ?? report.reporting_month),
      submission_date: scoped.submission_date !== undefined ? scoped.submission_date : report.submission_date,
      submitted_by: scoped.submitted_by !== undefined
        ? resolveSubmittedBy(req.user, scoped.submitted_by)
        : report.submitted_by,
      created_by_user_id: report.created_by_user_id || req.user?.id || null,
      status,
      title: title || null,
      payload: { rows },
    });

    const full = await findReport(report.id);
    res.json({ success: true, data: mapReport(full) });
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
    const report = await VehicleMaintenanceReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Not found" });
    const access = await assertRecordAccess(req.user, report);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    if (status === "submitted" || status === "approved") {
      const err = validateRows(normalizeRows(report.payload || {}), { requireComplete: true });
      if (err) return res.status(422).json({ success: false, message: err });
    }
    await report.update({ status });
    const full = await findReport(report.id);
    res.json({ success: true, data: mapReport(full) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReport,
  listReports,
  getReport,
  updateReport,
  updateStatus,
  REPORT_TYPE,
};
