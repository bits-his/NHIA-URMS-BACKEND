/**
 * Add approval-chain columns to monthly report tables (idempotent).
 * Run: node src/scripts/addMonthlyApprovalColumns.js
 */
require("dotenv").config();
const sequelize = require("../config/database");

const TABLES = [
  "finance_monthly_reports",
  "programmes_monthly_reports",
  "sqa_monthly_reports",
];

const COLUMNS = [
  { name: "state_reviewed_by",  sql: "VARCHAR(100) NULL" },
  { name: "state_reviewed_at",  sql: "DATETIME NULL" },
  { name: "state_review_note",  sql: "TEXT NULL" },
  { name: "zonal_reviewed_by",  sql: "VARCHAR(100) NULL" },
  { name: "zonal_reviewed_at",  sql: "DATETIME NULL" },
  { name: "zonal_review_note",  sql: "TEXT NULL" },
  { name: "rejection_reason",   sql: "TEXT NULL" },
  { name: "rejected_by",        sql: "VARCHAR(100) NULL" },
  { name: "rejected_at",        sql: "DATETIME NULL" },
];

const STATUS_ENUM = "ENUM('draft','submitted','under_review','zonal_review','approved','rejected') NOT NULL DEFAULT 'draft'";

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return Number(rows[0].cnt) > 0;
}

async function tableExists(table) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    { replacements: [table] }
  );
  return Number(rows[0].cnt) > 0;
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    for (const table of TABLES) {
      if (!(await tableExists(table))) {
        console.log(`⚠️   Table ${table} not found — skipping`);
        continue;
      }

      for (const col of COLUMNS) {
        if (await columnExists(table, col.name)) {
          console.log(`ℹ️   ${table}.${col.name} already exists`);
        } else {
          await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.sql}`);
          console.log(`✅  Added ${table}.${col.name}`);
        }
      }

      await sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`status\` ${STATUS_ENUM}`
      );
      console.log(`✅  Updated ${table}.status enum`);
    }

    console.log("✅  Monthly approval columns migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
