/**
 * Adds coordinator review columns to state-office report header tables (idempotent).
 */
require("dotenv").config();
const sequelize = require("../config/database");
const { syncStateOfficeTables } = require("./stateOfficeTableSync");
const models = require("../models");

const REVIEW_COLS = [
  { name: "coordinator_review_note", sql: "TEXT NULL" },
  { name: "coordinator_reviewed_by", sql: "VARCHAR(100) NULL" },
  { name: "coordinator_reviewed_at", sql: "DATETIME NULL" },
];

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column } },
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function main() {
  await syncStateOfficeTables(sequelize, models, { log: false });
  const tables = [
    "enrolment_reports", "migration_reports", "cemonc_reports", "igr_reports",
    "sshia_financial_reports", "expenditure_profile_reports", "complaints_compliance_reports",
    "accreditation_reports", "stakeholder_reports", "enrolment_drive_reports",
    "hmo_selection_reports", "extra_dependant_reports", "hcp_change_reports",
    "challenges_reports", "weekly_actionable_reports", "contracted_services_reports",
    "monthly_enrollee_registers", "etmc_tmc_action_point_registers",
    "ict_support_reports", "adhoc_assignment_reports",
  ];

  for (const table of tables) {
    for (const col of REVIEW_COLS) {
      if (await columnExists(table, col.name)) continue;
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.sql}`);
      console.log(`  + ${table}.${col.name}`);
    }
  }
  console.log("✅ State office review columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
