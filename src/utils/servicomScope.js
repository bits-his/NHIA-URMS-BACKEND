const { Op } = require("sequelize");
const { findActiveRole } = require("./roleService");
const { ROLE_SCOPE_FALLBACK } = require("./stateOfficeScope");

const NATIONAL_ROLES = new Set(["admin", "sdo", "hq-department", "dg-ceo"]);

function userGeo(user) {
  if (!user) return { zone_id: null, state_id: null };
  const zone_id = user.zone_id ?? user.get?.("zone_id") ?? null;
  const state_id = user.state_id ?? user.get?.("state_id") ?? null;
  return { zone_id, state_id };
}

async function resolveScope(user) {
  const roleKey = user?.role;
  if (!roleKey) return "none";
  if (NATIONAL_ROLES.has(roleKey) || roleKey === "admin" || roleKey === "sdo" || roleKey === "dg-ceo") {
    return "national";
  }

  const roleDef = await findActiveRole(roleKey);
  const fromDb = roleDef?.report_scope;
  if (fromDb && fromDb !== "none") return fromDb;
  return ROLE_SCOPE_FALLBACK[roleKey] || "none";
}

async function buildServicomListWhere(user, query = {}) {
  const where = {};
  const scope = await resolveScope(user);
  const { zone_id: userZoneId, state_id: userStateId } = userGeo(user);

  if (query.state_id) where.state_id = query.state_id;
  if (query.zone_id) where.zone_id = query.zone_id;
  if (query.status) where.status = query.status;
  if (query.monitoring_type) where.monitoring_type = query.monitoring_type;
  if (query.compliance_rating) where.compliance_rating = query.compliance_rating;
  if (query.from || query.to) {
    where.visit_date = {};
    if (query.from) where.visit_date[Op.gte] = query.from;
    if (query.to) where.visit_date[Op.lte] = query.to;
  }

  if (scope === "national" || scope === "none") {
    return where;
  }

  if (scope === "state") {
    if (!userStateId) {
      where.state_id = -1;
      return where;
    }
    where.state_id = userStateId;
    if (userZoneId) where.zone_id = userZoneId;
    return where;
  }

  if (scope === "zonal") {
    if (!userZoneId) {
      where.zone_id = -1;
      return where;
    }
    where.zone_id = userZoneId;
    return where;
  }

  return where;
}

const SUBMITTERS = ["state-officer", "state-coordinator", "department-officer", "admin", "sdo"];
const REVIEWERS = ["state-coordinator", "zonal-coordinator", "sdo", "admin"];

module.exports = { buildServicomListWhere, SUBMITTERS, REVIEWERS };
