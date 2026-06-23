/**
 * Create roles table, convert users.role to VARCHAR, seed default roles.
 * Run: node src/scripts/migrateRoles.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const Role = require("../models/Role");
const { seedDefaultRoles } = require("../utils/roleService");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    await Role.sync();
    console.log("✅  roles table ready");

    const [cols] = await sequelize.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
    );
    const colType = cols[0]?.COLUMN_TYPE || "";
    if (colType.startsWith("enum")) {
      await sequelize.query(
        "ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'state-officer'"
      );
      console.log("✅  users.role converted from ENUM to VARCHAR(50)");
    } else {
      console.log("ℹ️   users.role already VARCHAR");
    }

    await seedDefaultRoles();
    const count = await Role.count();
    console.log(`✅  ${count} roles seeded`);

    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
