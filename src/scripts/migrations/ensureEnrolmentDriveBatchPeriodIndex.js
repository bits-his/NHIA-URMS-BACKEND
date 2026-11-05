/**
 * Allow multiple enrolment drive reports per state/month.
 * Safe to run on every boot — drops the old unique index if present.
 */
const sequelize = require("../../config/database");

async function ensureEnrolmentDriveBatchPeriodIndex() {
  const [[row]] = await sequelize.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'enrolment_drive_batches'
       AND index_name = 'uq_drive_batch_state_period'`,
  );
  if (Number(row?.cnt || 0) > 0) {
    // Keep a non-unique covering index for FK/lookups before dropping the unique one.
    try {
      await sequelize.query(
        "CREATE INDEX idx_drive_batch_state_period ON enrolment_drive_batches (state_code, reporting_year, reporting_month)",
      );
    } catch (_) {
      /* already exists */
    }
    await sequelize.query("ALTER TABLE enrolment_drive_batches DROP INDEX uq_drive_batch_state_period");
    console.log("ℹ️   Dropped uq_drive_batch_state_period (multiple reports per month allowed)");
  }
}

module.exports = { ensureEnrolmentDriveBatchPeriodIndex };
