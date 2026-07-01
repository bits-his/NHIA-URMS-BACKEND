/**
 * Role-based geo filters for state office modules.
 * Uses roles.report_scope: state → one state, zonal → one zone, national/none → all.
 */
const { findActiveRole } = require("./roleService");
const { StateOffice } = require("../models");

const NATIONAL_ROLES = new Set(["admin", "sdo", "hq-department", "dg-ceo"]);

/** When roles table has scope "none", infer from system role key. */
const ROLE_SCOPE_FALLBACK = {
  "state-coordinator": "state",
  "state-officer": "state",
  "department-officer": "state",
  "zonal-coordinator": "zonal",
  "zonal-officer": "zonal",
};

function userGeo(user) {
  if (!user) return { zone_id: null, state_id: null };
  const zone_id = user.zone_id ?? user.zone?.id ?? user.get?.("zone_id") ?? null;
  const state_id = user.state_id ?? user.state?.id ?? user.get?.("state_id") ?? null;
  return { zone_id, state_id };
}

/** Resolve zone from user row or their assigned state. */
async function resolveUserZoneId(user) {
  const { zone_id, state_id } = userGeo(user);
  if (zone_id) return zone_id;
  if (!state_id) return null;
  const state = await StateOffice.findByPk(state_id, { attributes: ["zonal_id"] });
  return state?.zonal_id ?? null;
}

async function resolveScope(user) {
  const roleKey = user?.role;
  if (!roleKey) return "none";
  if (NATIONAL_ROLES.has(roleKey)) return "national";

  const roleDef = await findActiveRole(roleKey);
  const fromDb = roleDef?.report_scope;
  if (fromDb && fromDb !== "none") return fromDb;
  return ROLE_SCOPE_FALLBACK[roleKey] || "none";
}

async function buildStateOfficeListWhere(user, query = {}) {
  const where = {};
  const scope = await resolveScope(user);
  const { zone_id: userZoneId, state_id: userStateId } = userGeo(user);

  if (query.zone_id) where.zone_id = query.zone_id;
  if (query.state_id) where.state_id = query.state_id;
  if (query.status) where.status = query.status;
  if (query.year) where.reporting_year = query.year;
  if (query.month) where.reporting_month = query.month;
  if (query.against_type) where.against_type = query.against_type;

  if (scope === "national" || scope === "none") {
    return where;
  }

  if (scope === "state") {
    if (!userStateId) {
      where.state_id = -1;
      return where;
    }
    where.state_id = userStateId;
    const zoneId = userZoneId || await resolveUserZoneId(user);
    if (zoneId) where.zone_id = zoneId;
    return where;
  }

  if (scope === "zonal") {
    const zoneId = userZoneId || await resolveUserZoneId(user);
    if (!zoneId) {
      where.zone_id = -1;
      return where;
    }
    where.zone_id = zoneId;
    if (query.state_id) {
      const inZone = await StateOffice.findOne({
        where: { id: query.state_id, zonal_id: userZoneId },
        attributes: ["id"],
      });
      if (!inZone) where.state_id = -1;
    }
    return where;
  }

  return where;
}

async function assertRecordAccess(user, record) {
  if (!record) return { ok: false, status: 404, message: "Not found" };

  const scope = await resolveScope(user);
  const { zone_id: userZoneId, state_id: userStateId } = userGeo(user);

  if (scope === "national" || scope === "none") return { ok: true };

  if (scope === "state") {
    if (!userStateId || Number(record.state_id) !== Number(userStateId)) {
      return { ok: false, status: 403, message: "Access denied for this state" };
    }
    return { ok: true };
  }

  if (scope === "zonal") {
    if (!userZoneId || Number(record.zone_id) !== Number(userZoneId)) {
      return { ok: false, status: 403, message: "Access denied for this zone" };
    }
    return { ok: true };
  }

  return { ok: true };
}

async function applyScopeToBody(user, body = {}) {
  const scope = await resolveScope(user);
  if (scope === "national" || scope === "none") return body;

  const out = { ...body };
  const { zone_id: userZoneId, state_id: userStateId } = userGeo(user);

  if (scope === "state") {
    if (!userStateId) {
      const err = new Error("Your account is not assigned to a state");
      err.status = 403;
      throw err;
    }
    out.state_id = userStateId;
    const zoneId = userZoneId || await resolveUserZoneId(user);
    if (zoneId) out.zone_id = zoneId;
    return out;
  }

  if (scope === "zonal") {
    const zoneId = userZoneId || await resolveUserZoneId(user);
    if (!zoneId) {
      const err = new Error("Your account is not assigned to a zone");
      err.status = 403;
      throw err;
    }
    out.zone_id = zoneId;
    if (out.state_id) {
      const inZone = await StateOffice.findOne({
        where: { id: out.state_id, zonal_id: zoneId },
        attributes: ["id"],
      });
      if (!inZone) {
        const err = new Error("Selected state is outside your zone");
        err.status = 403;
        throw err;
      }
    }
    return out;
  }

  return out;
}

/** Scope zone dropdown/list API — state & zonal users see only their zone. */
async function buildZoneLookupWhere(user) {
  const scope = await resolveScope(user);
  if (scope === "national" || scope === "none") return {};

  const zoneId = await resolveUserZoneId(user);
  if (!zoneId) return { id: -1 };
  return { id: zoneId };
}

/** Scope state dropdown/list API. */
async function buildStateLookupWhere(user, query = {}) {
  const scope = await resolveScope(user);
  const { state_id: userStateId } = userGeo(user);
  const zoneId = await resolveUserZoneId(user);

  if (scope === "national" || scope === "none") {
    return query.zone_id ? { zonal_id: query.zone_id } : {};
  }

  if (scope === "state") {
    if (!userStateId) return { id: -1 };
    return { id: userStateId };
  }

  if (scope === "zonal") {
    if (!zoneId) return { id: -1 };
    const where = { zonal_id: zoneId };
    if (query.zone_id && Number(query.zone_id) !== Number(zoneId)) {
      return { id: -1 };
    }
    return where;
  }

  return {};
}

module.exports = {
  resolveScope,
  resolveUserZoneId,
  userGeo,
  buildStateOfficeListWhere,
  buildZoneLookupWhere,
  buildStateLookupWhere,
  assertRecordAccess,
  applyScopeToBody,
  ROLE_SCOPE_FALLBACK,
};
