/**
 * Migration: create weekly_actionable_reports, weekly_actionable_report_lines,
 *            contracted_services_reports, contracted_services_report_lines
 *
 * Run once:  node src/scripts/addWeeklyActionableAndContractedServices.js
 */

require("dotenv").config();
const sequelize = require("../config/database");

// Register models & associations so Sequelize knows the table shapes
require("../models/index");

const {
  WeeklyActionableReport,
  WeeklyActionableReportLine,
  ContractedServicesReport,
  ContractedServicesReportLine,
} = require("../models");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    // alter:false → only creates missing tables; never modifies existing ones
    await WeeklyActionableReport.sync({ alter: false });
    console.log("✅  weekly_actionable_reports – synced");

    await WeeklyActionableReportLine.sync({ alter: false });
    console.log("✅  weekly_actionable_report_lines – synced");

    await ContractedServicesReport.sync({ alter: false });
    console.log("✅  contracted_services_reports – synced");

    await ContractedServicesReportLine.sync({ alter: false });
    console.log("✅  contracted_services_report_lines – synced");

    console.log("🎉  Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
