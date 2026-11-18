/**
 * Rebuild CRUD for JSON-payload state-office registers.
 * Accepts legacy zone_id / state_id body keys (mapped to zonal_code / state_code).
 * ICT Support posts `lines` at the top level; they are stored on payload.lines
 * and returned again as `lines` so the existing form can load them.
 */
const { ZonalOffice, StateOffice } = require("../models");
const {
  buildStateOfficeListWhere,
  withCoordinatorTeam,
  assertRecordAccess,
  applyScopeToBody,
  isReportingOfficerRole,
  resolveSubmittedBy,
} = require("../utils/stateOfficeScope");

function storedPayload(body) {
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? { ...body.payload }
    : {};
  if (Array.isArray(body.lines)) payload.lines = body.lines;
  return payload;
}

function makePayloadPack({ Model, reportType, refPrefix }) {
  function mapReport(row) {
    const p = row.toJSON ? row.toJSON() : { ...row };
    const payload = p.payload && typeof p.payload === "object" ? p.payload : {};
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    return {
      ...p,
      id: p.reference_id,
      payload,
      lines,
      zone_id: p.zonal_code,
      state_id: p.state_code,
      report_type: reportType,
      zone: p.zone
        ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
        : undefined,
      state: p.state
        ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
        : undefined,
    };
  }

  const findReport = (id) =>
    Model.findByPk(id, {
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
      ],
    });

  async function generateRefId() {
    const year = new Date().getFullYear();
    const count = await Model.count();
    return `${refPrefix}-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  function geoFromBody(body) {
    return {
      zonal_code: body.zonal_code || body.zone_id || null,
      state_code: body.state_code || body.state_id || null,
    };
  }

  function cleanWhere(where) {
    if (where.zone_id && !where.zonal_code) {
      where.zonal_code = where.zone_id;
      delete where.zone_id;
    }
    if (where.state_id && !where.state_code) {
      where.state_code = where.state_id;
      delete where.state_id;
    }
    return where;
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

      const payload = storedPayload(scoped);
      const status = scoped.status || "draft";
      const report = await Model.create({
        reference_id: scoped.reference_id || await generateRefId(),
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        reporting_year: Number(scoped.reporting_year),
        reporting_month: Number(scoped.reporting_month),
        submission_date: scoped.submission_date || null,
        submitted_by: resolveSubmittedBy(req.user, scoped.submitted_by),
        created_by_user_id: req.user?.id || null,
        status,
        title: scoped.title || null,
        payload,
      });

      const full = await findReport(report.reference_id);
      res.status(201).json({ success: true, data: mapReport(full) });
    } catch (err) {
      next(err);
    }
  };

  const listReports = async (req, res, next) => {
    try {
      let where = await buildStateOfficeListWhere(req.user, req.query, null);
      if (isReportingOfficerRole(req.user?.role)) {
        if (!req.user?.id) {
          return res.status(401).json({ success: false, message: "Authentication required" });
        }
        where.created_by_user_id = req.user.id;
      } else {
        where = await withCoordinatorTeam(req.user, where, Model);
      }
      cleanWhere(where);

      const list = await Model.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
          { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
        ],
        order: [["created_at", "DESC"]],
      });
      res.json({ success: true, data: list.map(mapReport) });
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
      const report = await Model.findByPk(req.params.id);
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

      const payload = scoped.payload !== undefined || Array.isArray(scoped.lines)
        ? storedPayload(scoped)
        : report.payload;

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
        status: scoped.status || report.status,
        title: scoped.title !== undefined ? scoped.title : report.title,
        payload,
      });

      const full = await findReport(report.reference_id);
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
      const report = await Model.findByPk(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: "Not found" });
      const access = await assertRecordAccess(req.user, report);
      if (!access.ok) {
        return res.status(access.status).json({ success: false, message: access.message });
      }
      await report.update({ status });
      const full = await findReport(report.reference_id);
      res.json({ success: true, data: mapReport(full) });
    } catch (err) {
      next(err);
    }
  };

  return { createReport, listReports, getReport, updateReport, updateStatus, REPORT_TYPE: reportType };
}

module.exports = { makePayloadPack };
