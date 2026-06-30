/**
 * Create expenditure_profile_reports / expenditure_profile_report_lines tables.
 * Run: npm run db:migrate-expenditure-profile
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    await sequelize.sync({ alter: true });
    console.log("✅  Expenditure Profile report tables synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
