/**
 * Idempotent: outcomes, follow_up_details, location_specify on stakeholder_report_lines.
 *
 *   node src/scripts/addStakeholderEngagementFields.js
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
    const table = "stakeholder_report_lines";
    const cols = [
      ["follow_up_details", "JSON NULL AFTER `follow_up_visits`"],
      ["location_specify", "VARCHAR(255) NULL AFTER `location_name`"],
      ["outcomes", "JSON NULL AFTER `specific_outcome`"],
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
