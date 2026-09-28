/**
 * Role-based geo filters for state office modules.
 * Uses roles.report_scope: state → one state, zonal → one zone, national/none → all.
 */
const { Op } = require("sequelize");
const { findActiveRole } = require("./roleService");
const { StateOffice, User } = require("../models");

function isStateCoordinatorRole(role) {
  const r = String(role || "");
  return r === "state-coordinator" || r.endsWith("-state-coordinator");
}

function isZonalCoordinatorRole(role) {
  const r = String(role || "");
  return r === "zonal-coordinator" || r.endsWith("-zonal-coordinator");
}

function isCoordinatorRole(role) {
  return isStateCoordinatorRole(role) || isZonalCoordinatorRole(role);
}

/**
 * Names of the coordinator + their team: users in the same state (state coordinator) or zone
 * (zonal coordinator) sharing the role prefix (e.g. "enf-"), else the same department.
 */
async function coordinatorTeamNames(user) {
  if (!user || !isCoordinatorRole(user.role)) return [];
  const geoKey = isZonalCoordinatorRole(user.role) ? "zone_id" : "state_id";
  const geoVal = userGeo(user)[geoKey];
  const names = new Set([user.name].filter(Boolean));
  if (!geoVal) return [...names];
  const prefix = String(user.role).match(/^([a-z0-9]+)-(state|zonal)-coordinator$/)?.[1];
  const where = { [geoKey]: geoVal, is_active: true };
  if (prefix) where.role = { [Op.like]: `${prefix}-%` };
  else if (user.department_id) where.department_id = user.department_id;
  const team = await User.findAll({ where, attributes: ["name"] });
  team.forEach((u) => u.name && names.add(u.name));
  return [...names];
}

function creatorColumns(Model) {
  const attrs = Model?.rawAttributes ?? {};
  return ["submitted_by", "created_by"].filter((c) => attrs[c]);
}

/**
 * For coordinators, widen a scoped list where to: (area filters) OR (created by their team).
 * Non-geo filters (status, month, year…) still apply to both.
 */
async function withCoordinatorTeam(user, where, Model) {
  if (!isCoordinatorRole(user?.role)) return where;
  const cols = creatorColumns(Model);
  if (!cols.length) return where;
  const names = await coordinatorTeamNames(user);
  if (!names.length) return where;
  const { zone_id, state_id, ...rest } = where;
  const area = {};
  if (zone_id !== undefined) area.zone_id = zone_id;
  if (state_id !== undefined) area.state_id = state_id;
  if (!Object.keys(area).length) return where;
  const teamClauses = cols.map((c) => ({ [c]: { [Op.in]: names } }));
  return { ...rest, [Op.or]: [area, ...teamClauses] };
}

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
        where: { id: query.state_id, zonal_id: zoneId },
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
  const result = await assertAreaAccess(user, record);
  if (result.ok || !isCoordinatorRole(user?.role)) return result;
  const names = await coordinatorTeamNames(user);
  const creators = [record.submitted_by, record.created_by].filter(Boolean);
  return creators.some((c) => names.includes(c)) ? { ok: true } : result;
}

async function assertAreaAccess(user, record) {
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
  // Record the real author (the UI sends a generic "State Office") so coordinators can see their team's work.
  if (user?.name) out.submitted_by = user.name;
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
  withCoordinatorTeam,
  isCoordinatorRole,
  ROLE_SCOPE_FALLBACK,
};
