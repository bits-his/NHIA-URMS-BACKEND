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

/**
 * Extra complaint list/dashboard filters: facility, HMO, transmission route.
 * Mutates and returns `where`.
 */
function applyComplaintExtraFilters(where, query = {}) {
  const and = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];

  if (query.transmission_route) {
    and.push({ transmission_route: query.transmission_route });
  }

  if (query.hmo_id) {
    and.push({
      [Op.or]: [
        { complainant_hmo_id: query.hmo_id },
        { respondent_hmo_id: query.hmo_id },
      ],
    });
  }

  const facilityId = query.facility_id || query.hcf_id;
  if (facilityId) {
    and.push({
      [Op.or]: [
        { facility_id: facilityId },
        { complainant_hcf_id: facilityId },
        { respondent_hcf_id: facilityId },
      ],
    });
  }

  if (query.facility_name) {
    const like = { [Op.like]: `%${String(query.facility_name).trim()}%` };
    and.push({
      [Op.or]: [
        { facility_name: like },
        { respondent_name: like },
        { complainant_name: like },
      ],
    });
  }

  if (and.length) where[Op.and] = and;
  return where;
}

const SUBMITTERS = ["state-officer", "state-coordinator", "department-officer", "admin", "sdo"];
const REVIEWERS = ["state-coordinator", "zonal-coordinator", "sdo", "admin"];

module.exports = { buildServicomListWhere, applyComplaintExtraFilters, SUBMITTERS, REVIEWERS };
