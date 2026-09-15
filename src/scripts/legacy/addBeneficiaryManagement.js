/**
 * Sync Beneficiary Management tables (extra dependant, HCP change, HMO selection columns).
 *
 *   node src/scripts/legacy/addBeneficiaryManagement.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
const {
  ExtraDependantReport, ExtraDependantReportLine,
  HcpChangeReport, HcpChangeReportLine,
  HmoSelectionReportLine,
} = require("../../models");

(async () => {
  try {
    await sequelize.authenticate();
    await ExtraDependantReport.sync({ alter: false });
    await ExtraDependantReportLine.sync({ alter: false });
    await HcpChangeReport.sync({ alter: false });
    await HcpChangeReportLine.sync({ alter: false });
    await HmoSelectionReportLine.sync({ alter: true });
    console.log("✅  Beneficiary Management tables – synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
