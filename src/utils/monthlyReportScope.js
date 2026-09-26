/**
 * Role-based list filters for monthly reports.
 * Scoping is driven by the roles table (report_scope column).
 */
const { Op } = require("sequelize");
const { findActiveRole } = require("./roleService");
const { ROLE_SCOPE_FALLBACK } = require("./stateOfficeScope");

const STATUS = {
  INBOX_COORDINATOR: ["submitted", "under_review", "zonal_review", "approved", "rejected"],
  INBOX_ZONAL:       ["under_review", "zonal_review", "approved", "rejected"],
};

const NATIONAL_ROLES = new Set(["admin", "sdo", "hq-department", "dg-ceo"]);

function userGeo(user) {
  if (!user) return { zone_id: null, state_id: null };
  const zone_id = user.zone_id ?? user.get?.("zone_id") ?? null;
  const state_id = user.state_id ?? user.get?.("state_id") ?? null;
  return { zone_id, state_id };
}

async function resolveReportScope(user) {
  const roleKey = user?.role;
  if (!roleKey) return "none";
  if (NATIONAL_ROLES.has(roleKey)) return "national";

  const roleDef = await findActiveRole(roleKey);
  const fromDb = roleDef?.report_scope;
  if (fromDb && fromDb !== "none") return fromDb;
  return ROLE_SCOPE_FALLBACK[roleKey] || "none";
}

async function buildMonthlyListWhere(user, query, StateOffice) {
  const where = {};
  const roleKey = user?.role;
  const { zone_id: userZoneId, state_id: userStateId } = userGeo(user);

  if (query.state_id) where.state_id = query.state_id;
  if (query.year)     where.reporting_year  = query.year;
  if (query.month)    where.reporting_month = query.month;
  if (query.status)   where.status = query.status;
  if (query.section)  where.section = query.section;

  const scope = await resolveReportScope(user);

  if (scope === "national" || scope === "none") {
    return where;
  }

  if (scope === "zonal") {
    if (!userZoneId) {
      where.state_id = -1;
      return where;
    }
    const zoneStates = await StateOffice.findAll({
      where: { zonal_id: userZoneId },
      attributes: ["id"],
    });
    const stateIds = zoneStates.map((s) => s.id);
    if (stateIds.length) where.state_id = { [Op.in]: stateIds };
    else where.state_id = -1;
    if (!query.status) where.status = { [Op.in]: STATUS.INBOX_ZONAL };
    return where;
  }

  if (scope === "state") {
    if (!userStateId) {
      where.state_id = -1;
      return where;
    }
    where.state_id = userStateId;
    const roleDef = await findActiveRole(roleKey);
    if (roleDef?.can_review_monthly && !query.status) {
      where.status = { [Op.in]: STATUS.INBOX_COORDINATOR };
    }
    return where;
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

/**
 * Who may create/update form records.
 * - Review-only roles (can_review, no can_create) are blocked.
 * - Everyone else who can open a page (authenticated + privileges on FE/state-office)
 *   may submit — including custom roles with page access and no review flag.
 */
async function canSubmitForms(roleKey) {
  if (!roleKey) return false;
  if (roleKey === "admin") return true;
  const canCreate = await canCreateMonthlyReport(roleKey);
  const canReview = await canReviewMonthlyReport(roleKey);
  if (canReview && !canCreate) return false;
  return true;
}

module.exports = {
  buildMonthlyListWhere,
  canCreateMonthlyReport,
  canReviewMonthlyReport,
  canSubmitForms,
};
