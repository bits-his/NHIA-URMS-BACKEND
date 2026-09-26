/**
 * Create one login per department role (Reporting Officer, State Coordinator,
 * Zonal Coordinator) with that department's page pack.
 *
 *   node src/scripts/seedDepartmentUsers.js
 *
 * Password for newly created users: 123456
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
require("../models/index");
const { User, Department, ZonalOffice, StateOffice } = require("../models");
const { DEPARTMENT_ROLES, getDefaultAccess } = require("../utils/departmentRoleAccess");
const { logPartial } = require("../utils/seedUtils");

const PASSWORD = "123456";

async function seedDepartmentUsers() {
  const hashed = await bcrypt.hash(PASSWORD, 12);
  const zone = await ZonalOffice.findOne({ order: [["id", "ASC"]] });
  const state = await StateOffice.findOne({
    ...(zone ? { where: { zonal_id: zone.id } } : {}),
    order: [["id", "ASC"]],
  });

  const depts = await Department.findAll();
  const deptMap = Object.fromEntries(depts.map((d) => [d.department_code, d]));

  let created = 0;
  let skipped = 0;

  for (const role of DEPARTMENT_ROLES) {
    const staff_id = `${role.staff_id_prefix}-0001`;
    const existing = await User.findOne({ where: { staff_id } });
    if (existing) {
      skipped++;
      continue;
    }

    const dept = deptMap[role.department_code];
    const zone_id = role.report_scope === "zonal" || role.report_scope === "state" ? (zone?.id ?? null) : null;
    const state_id = role.report_scope === "state" ? (state?.id ?? null) : null;

    await User.create({
      name: role.label,
      staff_id,
      email: `${staff_id.toLowerCase()}@nhia.gov.ng`,
      password: hashed,
      role: role.key,
      zone_id,
      state_id,
      department_id: dept?.id ?? null,
      unit_id: null,
      is_active: true,
      functionalities: getDefaultAccess(role.key) || [],
    });
    created++;
    console.log(`  ✔  ${staff_id.padEnd(14)} ${role.label}`);
  }

  logPartial("Department users", created, skipped);
  if (created > 0) console.log(`🔑  Password for new department users: ${PASSWORD}`);
  return { created, skipped };
}

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      console.log("✅  DB connected\n");
      await seedDepartmentUsers();
      process.exit(0);
    } catch (err) {
      console.error("❌  Seed failed:", err);
      process.exit(1);
    }
  })();
}

module.exports = { seedDepartmentUsers };
