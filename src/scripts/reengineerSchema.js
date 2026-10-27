/**
 * Collapse the per-template report tables into submissions,
 * submission_lines, and submission_files.
 *
 * Reference catalogs, org data, complaints, compliance cases,
 * and the live store screens stay. Report and demo rows are dropped.
 * Run once: node src/scripts/reengineerSchema.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const Submission = require("../models/Submission");
const SubmissionLine = require("../models/SubmissionLine");
const SubmissionFile = require("../models/SubmissionFile");

const KEEP = new Set([
  "zonal_offices",
  "state_offices",
  "departments",
  "units",
  "users",
  "roles",
  "app_notifications",
  "hcf_facilities",
  "nhia_accredited_providers",
  "hmo_providers",
  "annual_reports",
  "quarterly_data",
  "servicom_complaints",
  "servicom_complaint_comments",
  "complaint_sla_rules",
  "servicom_audit_logs",
  "compliance_reports",
  "compliance_findings",
  "compliance_violations",
  "compliance_enforcement_actions",
  "store_assets",
  "store_inventory_items",
  "stock_issue_vouchers",
  "physical_asset_verifications",
  "physical_asset_verification_items",
  "prepayment_analyses",
  "state_zonal_office_profiles",
  "state_zonal_focal_persons",
  "submissions",
  "submission_lines",
  "submission_files",
]);

(async () => {
  try {
    await sequelize.authenticate();
    const [tables] = await sequelize.query(
      "SELECT TABLE_NAME AS name, TABLE_TYPE AS kind FROM information_schema.tables WHERE table_schema = DATABASE()",
    );
    const drop = tables.filter((row) => !KEEP.has(row.name));
    console.log(`Keeping ${tables.length - drop.length} tables. Dropping ${drop.length}:`);
    for (const row of drop) console.log(`  ${row.kind} ${row.name}`);

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const row of drop) {
      const sql = row.kind === "VIEW"
        ? `DROP VIEW IF EXISTS \`${row.name}\``
        : `DROP TABLE IF EXISTS \`${row.name}\``;
      await sequelize.query(sql);
    }
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    await Submission.sync({ alter: true });
    await SubmissionLine.sync({ alter: true });
    await SubmissionFile.sync({ alter: true });

    const [left] = await sequelize.query(
      "SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY TABLE_NAME",
    );
    console.log(`Schema now has ${left.length} tables.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
