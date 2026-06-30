/**
 * @deprecated Use npm run db:migrate-state-office
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    const { SshiaFinancialReport, SshiaFinancialReportLine } = require("../models");
    await SshiaFinancialReport.sync();
    await SshiaFinancialReportLine.sync();
    console.log("✅  SSHIA financial report tables synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
