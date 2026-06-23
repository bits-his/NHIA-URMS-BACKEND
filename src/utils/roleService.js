const { Role, User } = require("../models");

const DEFAULT_ROLES = [
  { key: "admin",               label: "Admin",               staff_id_prefix: "ADMIN", report_scope: "national", can_create_monthly: true,  can_review_monthly: true,  is_system: true },
  { key: "sdo",                 label: "SDO",                 staff_id_prefix: "SDO",   report_scope: "national", can_create_monthly: false, can_review_monthly: true,  is_system: true },
  { key: "hq-department",       label: "HQ Department",       staff_id_prefix: "HQ",    report_scope: "national", can_create_monthly: false, can_review_monthly: false, is_system: true },
  { key: "dg-ceo",              label: "DG-CEO",              staff_id_prefix: "DG",    report_scope: "national", can_create_monthly: false, can_review_monthly: false, is_system: true },
  { key: "zonal-coordinator",   label: "Zonal Coordinator",   staff_id_prefix: "ZC",    report_scope: "zonal",    can_create_monthly: false, can_review_monthly: true,  is_system: true },
  { key: "state-coordinator",   label: "State Coordinator",   staff_id_prefix: "SC",    report_scope: "state",    can_create_monthly: true,  can_review_monthly: true,  is_system: true },
  { key: "state-officer",       label: "State Officer",       staff_id_prefix: "SO",    report_scope: "state",    can_create_monthly: true,  can_review_monthly: false, is_system: true },
  { key: "department-officer",  label: "Department Officer",  staff_id_prefix: "DO",    report_scope: "state",    can_create_monthly: true,  can_review_monthly: false, is_system: true },
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
        is_system: true,
      });
    }
  }
}

module.exports = {
  DEFAULT_ROLES,
  KEY_RE,
  slugify,
  findActiveRole,
  validateRoleKey,
  generateStaffId,
  seedDefaultRoles,
};
