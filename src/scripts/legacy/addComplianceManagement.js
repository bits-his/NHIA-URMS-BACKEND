/**
 * Create compliance management tables (SQA — Facility Compliance Reporting).
 * Run: npm run db:migrate-compliance
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");

const {
  ComplianceReport,
  ComplianceFinding,
  ComplianceViolation,
  ComplianceEnforcementAction,
} = require("../../models");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    await ComplianceReport.sync({ alter: false });
    console.log("✅  compliance_reports");

    await ComplianceFinding.sync({ alter: false });
    console.log("✅  compliance_findings");

    await ComplianceViolation.sync({ alter: false });
    console.log("✅  compliance_violations");

    await ComplianceEnforcementAction.sync({ alter: false });
    console.log("✅  compliance_enforcement_actions");

    console.log("🎉  Compliance management migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
