/**
 * @deprecated Use npm run db:migrate-state-office
 * Kept for backwards compatibility — create-only sync (no ALTER).
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    console.log("ℹ️   Prefer: npm run db:migrate-state-office");
    const { IgrReport, IgrReportLine } = require("../models");
    await IgrReport.sync();
    await IgrReportLine.sync();
    console.log("✅  IGR report tables synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
