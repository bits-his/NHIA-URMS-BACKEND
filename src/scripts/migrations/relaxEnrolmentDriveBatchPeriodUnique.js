/**
 * Allow multiple enrolment drive reports per state/month.
 * Drops uq_drive_batch_state_period and ensures a non-unique index exists.
 *
 * Run: node src/scripts/migrations/relaxEnrolmentDriveBatchPeriodUnique.js
 */
const sequelize = require("../../config/database");

async function main() {
  // Ensure a non-unique covering index exists before dropping the unique one
  // (state_code FK still needs an index).
  try {
    await sequelize.query(
      "CREATE INDEX idx_drive_batch_state_period ON enrolment_drive_batches (state_code, reporting_year, reporting_month)",
    );
    console.log("Added idx_drive_batch_state_period");
  } catch (err) {
    console.warn("idx_drive_batch_state_period:", err.message);
  }

  try {
    await sequelize.query("ALTER TABLE enrolment_drive_batches DROP INDEX uq_drive_batch_state_period");
    console.log("Removed unique index uq_drive_batch_state_period");
  } catch (err) {
    console.warn("Could not remove uq_drive_batch_state_period:", err.message);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
