/**
 * Idempotent: adds beneficiary_status, supporting_evidence, status_reason
 * to enrolment_report_lines (PPT Step 3 fields).
 */
require("dotenv").config();
const sequelize = require("../config/database");

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column } },
  );
  return Number(rows[0]?.c || 0) > 0;
}

(async () => {
  try {
    await sequelize.authenticate();
    const table = "enrolment_report_lines";
    const cols = [
      ["beneficiary_status", "VARCHAR(80) NULL AFTER `beneficiary_category`"],
      ["supporting_evidence", "VARCHAR(120) NULL AFTER `funding_option`"],
      ["status_reason", "TEXT NULL AFTER `activity_status`"],
    ];
    for (const [name, ddl] of cols) {
      if (await columnExists(table, name)) {
        console.log(`${name} already exists`);
      } else {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${ddl}`);
        console.log(`Added ${name}`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
