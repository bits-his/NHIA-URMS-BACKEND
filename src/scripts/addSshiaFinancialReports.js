/**
 * Create sshia_financial_reports / sshia_financial_report_lines tables.
 * Run: npm run db:migrate-sshia-financial
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    await sequelize.sync({ alter: true });
    console.log("✅  SSHIA financial report tables synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
