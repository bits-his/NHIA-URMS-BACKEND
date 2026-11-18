/**
 * Create / alter ict_support_register_reports (and sibling payload registers if missing)
 * with FKs to zonal_offices, state_offices, and users.
 *
 * Usage: node src/scripts/syncIctSupportRegisterSchema.js
 */
require("dotenv").config();
const sequelize = require("../config/database");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    const {
      IctSupportRegisterReport,
      ConflictInfractionReport,
      EnrolleeFeedbackReport,
    } = require("../models");

    if (!IctSupportRegisterReport) {
      throw new Error(
        'IctSupportRegisterReport not loaded — check APPROVED_FORMS["ict-support-register"] in activeSchema.js',
      );
    }

    // Empty tables — drop/recreate so PK switches from numeric id → reference_id cleanly
    for (const table of [
      "ict_support_register_reports",
      "conflict_infraction_reports",
      "enrollee_feedback_reports",
    ]) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`🗑️  dropped ${table} (if existed)`);
    }

    await IctSupportRegisterReport.sync({ force: false });
    console.log("✅  synced ict_support_register_reports");

    if (ConflictInfractionReport) {
      await ConflictInfractionReport.sync({ force: false });
      console.log("✅  synced conflict_infraction_reports");
    }
    if (EnrolleeFeedbackReport) {
      await EnrolleeFeedbackReport.sync({ force: false });
      console.log("✅  synced enrollee_feedback_reports");
    }

    const [cols] = await sequelize.query("DESCRIBE ict_support_register_reports");
    console.table(
      cols.map((c) => ({
        Field: c.Field,
        Type: c.Type,
        Null: c.Null,
        Key: c.Key,
        Default: c.Default,
      })),
    );

    const [fks] = await sequelize.query(`
      SELECT
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME,
        rc.DELETE_RULE,
        rc.UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'ict_support_register_reports'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log("Foreign keys:");
    console.table(fks);

    process.exit(0);
  } catch (err) {
    console.error("❌  ICT support register schema sync failed:", err.message);
    process.exit(1);
  }
})();
