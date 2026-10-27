/**
 * Migrate departments: drop auto id PK, use department_code as PK.
 * Remap units.department_id → units.department_code
 * Remap users.department_id → users.department_code
 *
 * Usage: node src/scripts/redesign/migrateDepartmentCodePk.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");

async function dropFksOn(table, column) {
  const [fks] = await sequelize.query(
    `SELECT CONSTRAINT_NAME AS name
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: [table, column] },
  );
  for (const fk of fks) {
    await sequelize.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk.name}\``);
    console.log(`  dropped FK ${table}.${fk.name}`);
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  Connected");

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // Drop FKs that point at departments.id
    await dropFksOn("units", "department_id");
    await dropFksOn("users", "department_id");
    await dropFksOn("users", "department_code");
    await dropFksOn("units", "department_code");

    const [depts] = await sequelize.query(
      "SELECT id, department_code, name, description, location_scope, created_at, updated_at FROM departments",
    );
    console.log(`Departments: ${depts.length}`);

    const [units] = await sequelize.query(
      `SELECT u.id, u.unit_code, u.name, u.description, u.location_role,
              u.created_at, u.updated_at,
              d.department_code
       FROM units u
       LEFT JOIN departments d ON d.id = u.department_id`,
    );
    console.log(`Units: ${units.length}`);

    const userCols = await sequelize.getQueryInterface().describeTable("users");
    const [users] = await sequelize.query(
      userCols.department_id
        ? `SELECT u.id, d.department_code
           FROM users u
           LEFT JOIN departments d ON d.id = u.department_id`
        : `SELECT id, department_code FROM users`,
    );

    await sequelize.query("DROP TABLE IF EXISTS departments");
    await sequelize.query(
      `CREATE TABLE departments (
        department_code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        location_scope VARCHAR(10) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (department_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    for (const d of depts) {
      await sequelize.query(
        `INSERT INTO departments (department_code, name, description, location_scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            d.department_code,
            d.name,
            d.description,
            d.location_scope,
            d.created_at || new Date(),
            d.updated_at || new Date(),
          ],
        },
      );
    }
    console.log("✅  departments rebuilt with department_code PK");

    await sequelize.query("DROP TABLE IF EXISTS units");
    await sequelize.query(
      `CREATE TABLE units (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        unit_code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        location_role VARCHAR(12) NULL,
        department_code VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_units_code (unit_code),
        KEY idx_units_dept (department_code),
        CONSTRAINT fk_units_dept_code FOREIGN KEY (department_code)
          REFERENCES departments (department_code)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    for (const u of units) {
      if (!u.department_code) {
        console.warn(`  skip unit ${u.unit_code} — no department_code`);
        continue;
      }
      await sequelize.query(
        `INSERT INTO units (id, unit_code, name, description, location_role, department_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            u.id,
            u.unit_code,
            u.name,
            u.description,
            u.location_role,
            u.department_code,
            u.created_at || new Date(),
            u.updated_at || new Date(),
          ],
        },
      );
    }
    console.log("✅  units remapped to department_code");

    const userCols2 = await sequelize.getQueryInterface().describeTable("users");
    if (userCols2.department_id) {
      if (!userCols2.department_code) {
        await sequelize.query(
          "ALTER TABLE users ADD COLUMN department_code VARCHAR(20) NULL AFTER state_id",
        );
      }
      for (const u of users) {
        await sequelize.query(
          "UPDATE users SET department_code = ? WHERE id = ?",
          { replacements: [u.department_code || null, u.id] },
        );
      }
      await sequelize.query("ALTER TABLE users DROP COLUMN department_id");
      console.log("✅  users.department_id removed; department_code set");
    } else if (!userCols2.department_code) {
      await sequelize.query(
        "ALTER TABLE users ADD COLUMN department_code VARCHAR(20) NULL AFTER state_id",
      );
    }

    await dropFksOn("users", "department_code");
    await sequelize.query(
      `ALTER TABLE users
       ADD CONSTRAINT fk_users_department_code
       FOREIGN KEY (department_code) REFERENCES departments (department_code)
       ON UPDATE CASCADE ON DELETE SET NULL`,
    );

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅  Migration complete — department_code is PK");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err);
    process.exit(1);
  }
})();
