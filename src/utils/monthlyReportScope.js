/**
 * Role-based list filters for monthly reports.
 * Scoping is driven by the roles table (report_scope column).
 */
const { Op } = require("sequelize");
const { findActiveRole } = require("./roleService");

const STATUS = {
  INBOX_COORDINATOR: ["submitted", "under_review", "zonal_review", "approved", "rejected"],
  INBOX_ZONAL:       ["under_review", "zonal_review", "approved", "rejected"],
};

async function buildMonthlyListWhere(user, query, StateOffice) {
  const where = {};
  const roleKey = user?.role;
  const roleDef = await findActiveRole(roleKey);

  if (query.state_id) where.state_id = query.state_id;
  if (query.year)     where.reporting_year  = query.year;
  if (query.month)    where.reporting_month = query.month;
  if (query.status)   where.status = query.status;
  if (query.section)  where.section = query.section;

  const scope = roleDef?.report_scope || "none";

  if (scope === "national") {
    return where;
  }

  if (scope === "zonal" && user.zone_id && !query.state_id) {
    const zoneStates = await StateOffice.findAll({
      where: { zonal_id: user.zone_id },
      attributes: ["id"],
    });
    const stateIds = zoneStates.map((s) => s.id);
    if (stateIds.length) where.state_id = { [Op.in]: stateIds };
    if (!query.status) where.status = { [Op.in]: STATUS.INBOX_ZONAL };
  } else if (scope === "state" && user.state_id && !query.state_id) {
    where.state_id = user.state_id;
    if (roleKey === "state-coordinator" && !query.status) {
      where.status = { [Op.in]: STATUS.INBOX_COORDINATOR };
    }
  }

  return where;
}

async function canCreateMonthlyReport(roleKey) {
  const role = await findActiveRole(roleKey);
  return !!role?.can_create_monthly;
}

async function canReviewMonthlyReport(roleKey) {
  const role = await findActiveRole(roleKey);
  return !!role?.can_review_monthly;
}

module.exports = {
  buildMonthlyListWhere,
  canCreateMonthlyReport,
  canReviewMonthlyReport,
};
