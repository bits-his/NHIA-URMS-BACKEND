const { Role, User } = require("../models");
const { DEPARTMENT_ROLES } = require("./departmentRoleAccess");

const CORE_ROLES = [
  { key: "admin", label: "Admin", staff_id_prefix: "ADMIN", report_scope: "national", can_create_monthly: true,  can_review_monthly: true,  is_system: true },
  { key: "sdo",   label: "SDO",   staff_id_prefix: "SDO",   report_scope: "national", can_create_monthly: false, can_review_monthly: true,  is_system: true },
];

const DEFAULT_ROLES = [
  ...CORE_ROLES,
  ...DEPARTMENT_ROLES.map(({ department_code, ...role }) => role),
];

const KEY_RE = /^[a-z][a-z0-9-]*$/;

function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function findActiveRole(key) {
  if (!key) return null;
  return Role.findOne({ where: { key, is_active: true } });
}

async function validateRoleKey(key) {
  const role = await Role.findOne({ where: { key } });
  if (!role) return { ok: false, message: `Invalid role: "${key}"` };
  if (!role.is_active) return { ok: false, message: `Role "${key}" is inactive` };
  return { ok: true, role };
}

async function generateStaffId(roleKey) {
  const role = await Role.findOne({ where: { key: roleKey } });
  const prefix = role?.staff_id_prefix || "USR";
  const count = await User.count({ where: { role: roleKey } });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function seedDefaultRoles() {
  for (const r of DEFAULT_ROLES) {
    const [role] = await Role.findOrCreate({
      where: { key: r.key },
      defaults: r,
    });
    if (role.is_system) {
      await role.update({
        label: r.label,
        staff_id_prefix: r.staff_id_prefix,
        report_scope: r.report_scope,
        can_create_monthly: r.can_create_monthly,
        can_review_monthly: r.can_review_monthly,
        description: r.description ?? role.description,
        is_system: true,
      });
    }
  }
}

/** Map any role onto the SC → ZC → SDO approval step. */
async function resolveApprovalChainKey(roleKey) {
  if (!roleKey) return null;
  if (roleKey === "state-coordinator" || roleKey === "zonal-coordinator" || roleKey === "sdo") {
    return roleKey;
  }
  const role = await findActiveRole(roleKey);
  if (!role) return null;
  if (role.report_scope === "state" && role.can_review_monthly) return "state-coordinator";
  if (role.report_scope === "zonal" && role.can_review_monthly) return "zonal-coordinator";
  if (role.report_scope === "national" && role.can_review_monthly && !role.can_create_monthly) return "sdo";
  return null;
}

module.exports = {
  DEFAULT_ROLES,
  KEY_RE,
  slugify,
  findActiveRole,
  validateRoleKey,
  generateStaffId,
  seedDefaultRoles,
  resolveApprovalChainKey,
};
