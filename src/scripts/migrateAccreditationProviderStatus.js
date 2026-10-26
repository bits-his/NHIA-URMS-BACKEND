/**
 * Extend accreditation_reports.status for Provider Management endorsement workflow.
 * Does not change other state-office tables.
 *
 *   node src/scripts/migrateAccreditationProviderStatus.js
 */
require("dotenv").config();
const sequelize = require("../config/database");

const ENUM_SQL = `'draft','awaiting_review','returned','endorsed','submitted','approved'`;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.query(
      `ALTER TABLE accreditation_reports
       MODIFY COLUMN status ENUM(${ENUM_SQL}) NOT NULL DEFAULT 'draft'`,
    );
    console.log("✅ accreditation_reports.status supports provider endorsement workflow");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
