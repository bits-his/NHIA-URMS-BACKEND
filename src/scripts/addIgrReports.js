/**
 * Create igr_reports / igr_report_lines tables (idempotent via sync).
 * Run: npm run db:migrate-igr
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    await sequelize.sync({ alter: true });
    console.log("✅  IGR report tables synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
