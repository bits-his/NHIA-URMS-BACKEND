const { Op } = require("sequelize");
const { findActiveRole } = require("./roleService");

async function buildServicomListWhere(user, query = {}) {
  const where = {};
  const roleKey = user?.role;
  const roleDef = await findActiveRole(roleKey);
  const scope = roleDef?.report_scope || "none";

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

  if (scope === "national" || roleKey === "admin" || roleKey === "sdo" || roleKey === "dg-ceo") {
    return where;
  }

  if (scope === "zonal" && user.zone_id && !query.state_id) {
    where.zone_id = user.zone_id;
  } else if (scope === "state" && user.state_id && !query.state_id) {
    where.state_id = user.state_id;
  }

  return where;
}

const SUBMITTERS = ["state-officer", "state-coordinator", "department-officer", "admin", "sdo"];
const REVIEWERS = ["state-coordinator", "zonal-coordinator", "sdo", "admin"];

module.exports = { buildServicomListWhere, SUBMITTERS, REVIEWERS };
