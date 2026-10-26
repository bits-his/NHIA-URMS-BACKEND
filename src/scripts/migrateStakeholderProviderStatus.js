/**
 * Extend stakeholder_reports.status for State Coordinator endorsement + RO final submit.
 *
 * Legacy mapping:
 *   submitted → awaiting_review  (was waiting on SC)
 *   approved  → submitted        (SC already signed off; treat as final)
 *
 *   node src/scripts/migrateStakeholderProviderStatus.js
 */
require("dotenv").config();
const sequelize = require("../config/database");

const ENUM_SQL = `'draft','awaiting_review','returned','endorsed','submitted','approved'`;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.query(
      `ALTER TABLE stakeholder_reports
       MODIFY COLUMN status ENUM(${ENUM_SQL}) NOT NULL DEFAULT 'draft'`,
    );
    // Old "submitted" meant sent to SC — now that is awaiting_review
    await sequelize.query(
      `UPDATE stakeholder_reports SET status = 'awaiting_review' WHERE status = 'submitted'`,
    );
    // Old "approved" meant SC finished the report — map to final submitted
    await sequelize.query(
      `UPDATE stakeholder_reports SET status = 'submitted' WHERE status = 'approved'`,
    );
    console.log("✅ stakeholder_reports.status supports endorsement + RO final submit");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
