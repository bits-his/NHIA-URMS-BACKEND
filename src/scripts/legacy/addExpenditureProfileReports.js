/**
 * @deprecated Use npm run db:migrate-state-office
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    const { ExpenditureProfileReport, ExpenditureProfileReportLine } = require("../../models");
    await ExpenditureProfileReport.sync();
    await ExpenditureProfileReportLine.sync();
    console.log("✅  Expenditure Profile report tables synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
