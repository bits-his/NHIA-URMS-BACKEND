/**
 * Create ICT Support Register + Ad-hoc / Special Assignment tables.
 * Run: node src/scripts/legacy/addIctSupportAndAdhocAssignment.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const {
  IctSupportReport,
  IctSupportReportLine,
  AdhocAssignmentReport,
  AdhocAssignmentReportLine,
} = require("../../models");

(async () => {
  try {
    await sequelize.authenticate();
    await IctSupportReport.sync({ alter: false });
    console.log("✔ ict_support_reports");
    await IctSupportReportLine.sync({ alter: false });
    console.log("✔ ict_support_report_lines");
    await AdhocAssignmentReport.sync({ alter: false });
    console.log("✔ adhoc_assignment_reports");
    await AdhocAssignmentReportLine.sync({ alter: false });
    console.log("✔ adhoc_assignment_report_lines");
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
