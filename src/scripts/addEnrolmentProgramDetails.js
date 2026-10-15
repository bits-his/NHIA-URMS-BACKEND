/**
 * Idempotent: adds program_details JSON column to enrolment_report_lines.
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
    if (await columnExists(table, "program_details")) {
      console.log("program_details already exists");
    } else {
      await sequelize.query(
        "ALTER TABLE `enrolment_report_lines` ADD COLUMN `program_details` JSON NULL AFTER `remarks`",
      );
      console.log("Added program_details column");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
