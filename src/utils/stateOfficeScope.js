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
  return r === "zonal-coordinator" || r === "zc" || r.endsWith("-zonal-coordinator");
}

function isCoordinatorRole(role) {
  return isStateCoordinatorRole(role) || isZonalCoordinatorRole(role);
}

function isReportingOfficerRole(role) {
  const r = String(role || "");
  return r === "reporting-officer" || r.endsWith("-reporting-officer");
}

/** Match records authored by this user (submitted_by / created_by). */
function ownCreatorWhere(user, Model) {
  const cols = creatorColumns(Model);
  if (!cols.length || !user) return null;
  const clauses = [];
  const name = String(user.name || "").trim();
  if (name) {
    for (const c of cols) {
      clauses.push({ [c]: name });
      clauses.push({ [c]: { [Op.like]: `${name}%` } });
    }
  }
  const staffId = String(user.staff_id || "").trim();
  if (staffId) {
    for (const c of cols) {
      clauses.push({ [c]: { [Op.like]: `%(${staffId})%` } });
    }
  }
  return clauses.length ? { [Op.or]: clauses } : null;
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
  if (!user) return { zone_id: null, state_id: null, zonal_code: null, state_code: null };
  const zonal_code = user.zonal_code ?? user.zone?.zonal_code ?? user.get?.("zonal_code") ?? null;
  const state_code = user.state_code ?? user.state?.code ?? user.get?.("state_code") ?? null;
  // Legacy numeric ids (when present) plus code-based PK used by rebuild schema.
  const zone_id = user.zone_id ?? user.zone?.id ?? user.get?.("zone_id") ?? zonal_code ?? null;
  const state_id = user.state_id ?? user.state?.id ?? user.get?.("state_id") ?? state_code ?? null;
  return { zone_id, state_id, zonal_code, state_code };
}

/** Resolve zone from user row or their assigned state. */
async function resolveUserZoneId(user) {
  const { zone_id, state_id, zonal_code, state_code } = userGeo(user);
  if (zonal_code) return zonal_code;
  if (zone_id) return zone_id;
  const code = state_code || state_id;
  if (!code) return null;
  const state = await StateOffice.findByPk(code, { attributes: ["zonal_code"] });
  return state?.zonal_code ?? null;
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

/** Rebuild schema uses state_code / zonal_code as geo PKs. */
function applyGeoKeys(where, { stateKey, zoneKey }) {
  if (stateKey != null) where.state_code = stateKey;
  if (zoneKey != null) where.zonal_code = zoneKey;
  return where;
}

async function buildStateOfficeListWhere(user, query = {}, Model = null) {
  const where = {};
  const scope = await resolveScope(user);
  const { zone_id: userZoneId, state_id: userStateId, zonal_code: userZonalCode, state_code: userStateCode } = userGeo(user);
  const userStateKey = userStateCode || userStateId;
  const userZoneKey = userZonalCode || userZoneId;

  const queryState = query.state_code || query.state_id || null;
  const queryZone = query.zonal_code || query.zone_id || null;
  if (queryZone) applyGeoKeys(where, { zoneKey: queryZone });
  if (queryState) applyGeoKeys(where, { stateKey: queryState });
  if (query.status) where.status = query.status;
  if (query.year) where.reporting_year = query.year;
  if (query.month) where.reporting_month = query.month;
  if (query.against_type) where.against_type = query.against_type;

  if (scope === "national" || scope === "none") {
    // fall through — reporting officers still get own-creator filter below
  } else if (scope === "state") {
    if (!userStateKey) {
      applyGeoKeys(where, { stateKey: "__none__" });
      return where;
    }
    applyGeoKeys(where, { stateKey: userStateKey });
    const zoneId = userZoneKey || await resolveUserZoneId(user);
    if (zoneId) applyGeoKeys(where, { zoneKey: zoneId });
  } else if (scope === "zonal") {
    const zoneId = userZoneKey || await resolveUserZoneId(user);
    if (!zoneId) {
      applyGeoKeys(where, { zoneKey: "__none__" });
      return where;
    }
    applyGeoKeys(where, { zoneKey: zoneId });
    if (queryState) {
      const inZone = await StateOffice.findOne({
        where: { code: queryState, zonal_code: zoneId },
        attributes: ["code"],
      });
      if (!inZone) applyGeoKeys(where, { stateKey: "__none__" });
    }
  }

  // Reporting officers only see / edit their own submissions
  if (isReportingOfficerRole(user?.role) && Model) {
    const own = ownCreatorWhere(user, Model);
    if (!own) {
      where.id = -1;
      return where;
    }
    return { ...where, ...own };
  }

  return where;
}

function userOwnsRecord(user, record) {
  if (!user || !record) return false;
  if (user.id != null && record.created_by_user_id != null
    && Number(record.created_by_user_id) === Number(user.id)) {
    return true;
  }
  const creators = [record.submitted_by, record.created_by].filter(Boolean).map(String);
  if (!creators.length) return false;
  const name = String(user.name || "").trim();
  if (name && creators.some((c) => c === name || c.startsWith(name))) return true;
  const staffId = String(user.staff_id || "").trim();
  if (staffId && creators.some((c) => c.includes(`(${staffId})`))) return true;
  return false;
}

function resolveSubmittedBy(user, value) {
  const raw = value == null ? "" : String(value).trim();
  if (raw && raw !== "State Office") return raw;
  return user?.name || raw || null;
}

async function assertRecordAccess(user, record) {
  if (!record) return { ok: false, status: 404, message: "Not found" };

  if (isReportingOfficerRole(user?.role)) {
    if (!userOwnsRecord(user, record)) {
      return { ok: false, status: 403, message: "Access denied — you can only open reports you created" };
    }
    return { ok: true };
  }

  const result = await assertAreaAccess(user, record);
  if (result.ok || !isCoordinatorRole(user?.role)) return result;
  const names = await coordinatorTeamNames(user);
  const creators = [record.submitted_by, record.created_by].filter(Boolean);
  return creators.some((c) => names.includes(c)) ? { ok: true } : result;
}

async function assertAreaAccess(user, record) {
  const scope = await resolveScope(user);
  const { zone_id: userZoneId, state_id: userStateId, zonal_code: userZonalCode, state_code: userStateCode } = userGeo(user);
  const userStateKey = String(userStateCode || userStateId || "");
  const userZoneKey = String(userZonalCode || userZoneId || "");
  const recordState = String(record.state_code || record.state_id || "");
  const recordZone = String(record.zonal_code || record.zone_id || "");

  if (scope === "national" || scope === "none") return { ok: true };

  if (scope === "state") {
    if (!userStateKey || recordState !== userStateKey) {
      return { ok: false, status: 403, message: "Access denied for this state" };
    }
    return { ok: true };
  }

  if (scope === "zonal") {
    if (!userZoneKey || recordZone !== userZoneKey) {
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
  const { zone_id: userZoneId, state_id: userStateId, zonal_code: userZonalCode, state_code: userStateCode } = userGeo(user);
  const userStateKey = userStateCode || userStateId;
  const userZoneKey = userZonalCode || userZoneId;

  if (scope === "state") {
    if (!userStateKey) {
      const err = new Error("Your account is not assigned to a state");
      err.status = 403;
      throw err;
    }
    out.state_id = userStateKey;
    out.state_code = userStateKey;
    const zoneId = userZoneKey || await resolveUserZoneId(user);
    if (zoneId) {
      out.zone_id = zoneId;
      out.zonal_code = zoneId;
    }
    return out;
  }

  if (scope === "zonal") {
    const zoneId = userZoneKey || await resolveUserZoneId(user);
    if (!zoneId) {
      const err = new Error("Your account is not assigned to a zone");
      err.status = 403;
      throw err;
    }
    out.zone_id = zoneId;
    out.zonal_code = zoneId;
    const bodyState = out.state_code || out.state_id;
    if (bodyState) {
      const inZone = await StateOffice.findOne({
        where: { code: bodyState, zonal_code: zoneId },
        attributes: ["code"],
      });
      if (!inZone) {
        const err = new Error("Selected state is outside your zone");
        err.status = 403;
        throw err;
      }
      out.state_code = bodyState;
      out.state_id = bodyState;
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
  if (!zoneId) return { zonal_code: "__none__" };
  return { zonal_code: zoneId };
}

/** Scope state dropdown/list API. */
async function buildStateLookupWhere(user, query = {}) {
  const scope = await resolveScope(user);
  const { state_id: userStateId, state_code: userStateCode } = userGeo(user);
  const userStateKey = userStateCode || userStateId;
  const zoneId = await resolveUserZoneId(user);
  const queryZone = query.zonal_code || query.zone_id;

  if (scope === "national" || scope === "none") {
    return queryZone ? { zonal_code: queryZone } : {};
  }

  if (scope === "state") {
    if (!userStateKey) return { code: "__none__" };
    return { code: userStateKey };
  }

  if (scope === "zonal") {
    if (!zoneId) return { code: "__none__" };
    const where = { zonal_code: zoneId };
    if (queryZone && String(queryZone) !== String(zoneId)) {
      return { code: "__none__" };
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
  isReportingOfficerRole,
  resolveSubmittedBy,
  ROLE_SCOPE_FALLBACK,
};
