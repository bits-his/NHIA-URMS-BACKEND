/**
 * Sync Admin / HR report table only (avoids full db:sync when other tables block alter).
 *
 *   npm run db:update-admin-hr
 */
require("dotenv").config();
const sequelize = require("../config/database");
const { AdminHrReport } = require("../models");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    await AdminHrReport.sync({ alter: true });
    console.log("✅  admin_hr_reports synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Admin/HR sync failed:", err);
    process.exit(1);
  }
})();
