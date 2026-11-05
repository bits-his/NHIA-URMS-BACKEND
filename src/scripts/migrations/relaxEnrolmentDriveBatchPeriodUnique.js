/**
 * Allow multiple enrolment drive reports per state/month.
 * Drops uq_drive_batch_state_period and ensures a non-unique index exists.
 *
 * Run: node src/scripts/migrations/relaxEnrolmentDriveBatchPeriodUnique.js
 */
const sequelize = require("../../config/database");
const { ensureEnrolmentDriveBatchPeriodIndex } = require("./ensureEnrolmentDriveBatchPeriodIndex");

async function main() {
  await ensureEnrolmentDriveBatchPeriodIndex();
  console.log("Enrolment drive batch period index is ready");
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
