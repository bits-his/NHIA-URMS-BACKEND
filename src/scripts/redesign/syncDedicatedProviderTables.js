/**
 * Create dedicated Provider Management tables + report_status_events.
 * Usage: npm run db:redesign:sync-provider
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
const { PROVIDER_REPORT_PACKS } = require("../../models/providerManagement");
const ReportStatusEvent = require("../../models/ReportStatusEvent");

(async () => {
  try {
    await sequelize.authenticate();
    for (const { Report, Line } of PROVIDER_REPORT_PACKS) {
      await Report.sync({ alter: true });
      await Line.sync({ alter: true });
      console.log(`  synced ${Report.tableName} + ${Line.tableName}`);
    }
    await ReportStatusEvent.sync({ alter: true });
    console.log("  synced report_status_events");
    console.log("✅  Dedicated provider tables ready");
    process.exit(0);
  } catch (err) {
    console.error("❌  sync failed:", err);
    process.exit(1);
  }
})();
