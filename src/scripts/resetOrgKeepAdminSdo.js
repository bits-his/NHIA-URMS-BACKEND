/**
 * Wipe users / roles / departments / units except:
 *   - ADMIN001 (system admin)
 *   - SDO-0001 (SDO)
 * Then seed the diagram org catalog and 3 roles per department.
 *
 *   node src/scripts/resetOrgKeepAdminSdo.js
 */
require("dotenv").config();
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
require("../models/index");
const { User, Role, Department, Unit } = require("../models");
const { seedDefaultRoles } = require("../utils/roleService");
const { seedDepartmentsUnits } = require("./seedDepartmentsUnits");
const { seedDepartmentUsers } = require("./seedDepartmentUsers");
const { CORE, mergeAccess, accessForDepartment } = require("../utils/orgCatalog");

const KEEP_STAFF_IDS = ["ADMIN001", "SDO-0001"];
const KEEP_ROLES = ["admin", "sdo"];

async function nullIfTable(query, label) {
  try {
    const [result] = await sequelize.query(query);
    const n = result?.affectedRows ?? result;
    if (n) console.log(`  ✔  ${label}`);
  } catch (err) {
    if (!/doesn't exist|Unknown table|ER_NO_SUCH_TABLE/i.test(err.message)) {
      console.log(`  ℹ️  ${label}: ${err.message}`);
    }
  }
}

async function ensureKeepUser({ staff_id, name, email, role, password, functionalities }) {
  const existing = await User.findOne({ where: { staff_id } });
  if (existing) return existing;
  const hashed = await bcrypt.hash(password, 12);
  const created = await User.create({
    name,
    staff_id,
    email,
    password: hashed,
    role,
    is_active: true,
    department_id: null,
    unit_id: null,
    functionalities: functionalities || CORE,
  });
  console.log(`➕  Created missing keep-user ${staff_id} (${role})`);
  return created;
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected\n");

    await ensureKeepUser({
      staff_id: "ADMIN001",
      name: "System Administrator",
      email: "admin@nhia.gov.ng",
      role: "admin",
      password: "Admin@1234",
      functionalities: CORE,
    });
    await ensureKeepUser({
      staff_id: "SDO-0001",
      name: "National SDO",
      email: "sdo-0001@nhia.gov.ng",
      role: "sdo",
      password: "123456",
      functionalities: mergeAccess([
        ...accessForDepartment("SVC"),
        ...accessForDepartment("STK"),
        ...accessForDepartment("SOC"),
        { access_to: "SDO", functionalities: ["Ad-hoc / Special Assignment"] },
        { access_to: "Annual Reports", functionalities: ["Annual Report"] },
      ]),
    });

    const keepUsers = await User.findAll({
      where: { staff_id: { [Op.in]: KEEP_STAFF_IDS } },
      attributes: ["id", "staff_id", "role", "name"],
    });
    console.log("Keeping users:");
    keepUsers.forEach((u) => console.log(`  • ${u.staff_id}  ${u.role}  ${u.name}`));

    const keepIds = keepUsers.map((u) => u.id);
    if (keepIds.length < KEEP_STAFF_IDS.length) {
      throw new Error(`Could not resolve keep-users: ${KEEP_STAFF_IDS.join(", ")}`);
    }

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    await User.update(
      { department_id: null, unit_id: null },
      { where: { id: { [Op.in]: keepIds } } },
    );

    const deletedUsers = await User.destroy({
      where: { id: { [Op.notIn]: keepIds } },
    });
    console.log(`\n🗑  Users removed: ${deletedUsers}`);

    await nullIfTable("UPDATE stock_assets SET unit_id = NULL WHERE unit_id IS NOT NULL", "stock_assets.unit_id cleared");
    await nullIfTable("UPDATE stock_verifications SET department_id = NULL, unit_id = NULL WHERE department_id IS NOT NULL OR unit_id IS NOT NULL", "stock_verifications dept/unit cleared");
    await nullIfTable("UPDATE physical_asset_verifications SET department_id = NULL, unit_id = NULL WHERE department_id IS NOT NULL OR unit_id IS NOT NULL", "physical asset dept/unit cleared");
    await nullIfTable("UPDATE supply_verifications SET department_id = NULL, unit_id = NULL WHERE department_id IS NOT NULL OR unit_id IS NOT NULL", "supply verification dept/unit cleared");

    const unitsRemoved = await Unit.destroy({ where: {} });
    const deptsRemoved = await Department.destroy({ where: {} });
    console.log(`🗑  Units removed: ${unitsRemoved}`);
    console.log(`🗑  Departments removed: ${deptsRemoved}`);

    const rolesRemoved = await Role.destroy({
      where: { key: { [Op.notIn]: KEEP_ROLES } },
    });
    console.log(`🗑  Roles removed: ${rolesRemoved}`);
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("\n── Seeding departments & units ──");
    await seedDepartmentsUnits();

    console.log("\n── Seeding admin, SDO, and department roles ──");
    await seedDefaultRoles();

    console.log("\n── Seeding department users ──");
    await seedDepartmentUsers();

    const roleCount = await Role.count();
    const deptCount = await Department.count();
    const unitCount = await Unit.count();
    const userCount = await User.count();
    console.log(`\n✅  Remaining users: ${userCount}`);
    console.log(`✅  Roles: ${roleCount}`);
    console.log(`✅  Departments: ${deptCount}`);
    console.log(`✅  Units: ${unitCount}`);
    console.log("\nKept logins: ADMIN001  /  SDO-0001");
    console.log("Department users password: 123456");
    process.exit(0);
  } catch (err) {
    try { await sequelize.query("SET FOREIGN_KEY_CHECKS = 1"); } catch { /* ignore */ }
    console.error("❌  Reset failed:", err);
    process.exit(1);
  }
})();
