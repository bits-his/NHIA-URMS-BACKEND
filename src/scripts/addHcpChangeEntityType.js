/**
 * Idempotent: adds entity_type (hcp|hmo) to hcp_change_report_lines.
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
    const table = "hcp_change_report_lines";
    if (await columnExists(table, "entity_type")) {
      console.log("entity_type already exists");
    } else {
      await sequelize.query(
        "ALTER TABLE `hcp_change_report_lines` ADD COLUMN `entity_type` VARCHAR(10) NULL AFTER `nhia_number`",
      );
      console.log("Added entity_type column");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
