/**
 * Run schema sync, idempotent migrations, and all reference/demo seeds.
 *
 *   npm run db:seed-all     — sync + migrations + seeds (existing DBs)
 *   npm run db:seed         — idempotent migrations + seeds (adds missing rows only)
 *   npm run db:setup        — same as db:seed-all (fresh install)
 *
 * All steps are idempotent — existing rows are left unchanged; only missing seed data is inserted.
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;
const seedsOnly = process.argv.includes("--seeds-only");

const MIGRATE_STEPS = [
  { script: "src/scripts/syncDb.js", label: "Sync schema (tables)" },
  { script: "src/scripts/migrateRoles.js", label: "Roles" },
  { script: "src/scripts/legacy/addComplianceManagement.js", label: "Compliance tables" },
  { script: "src/scripts/legacy/migrateStateOfficeReports.js", label: "State Office tables" },
  { script: "src/scripts/legacy/migrateCompliancePrivileges.js", label: "Compliance privileges" },
  { script: "src/scripts/legacy/migrateSocZonesPrivileges.js", label: "SOC/Zones privileges" },
  { script: "src/scripts/legacy/addMonthlyEnrolleeRegister.js", label: "Monthly Enrollee Register table" },
  { script: "src/scripts/legacy/addEtmcTmcActionPoint.js", label: "ETMC/TMC Action-Point Register tables" },
  { script: "src/scripts/legacy/addBeneficiaryManagement.js", label: "Beneficiary Management tables" },
  { script: "src/scripts/legacy/migrateOthersPrivileges.js", label: "Zonal module privileges" },
  { script: "src/scripts/legacy/migrateSectionDashboards.js", label: "Section dashboards privileges" },
  { script: "src/scripts/updateStoreDb.js", label: "Store / Asset Management schema" },
  { script: "src/scripts/updateAdminHrDb.js", label: "Admin / HR reports schema" },
];

const demoUsers = process.argv.includes("--demo-users");

const SEED_STEPS = [
  { script: "src/scripts/seedZonesStates.js", label: "Zones & states" },
  { script: "src/scripts/seedDepartmentsUnits.js", label: "Departments & units" },
  { script: "src/scripts/seedUsers.js", label: "Demo users", forwardDemo: true },
  { script: "src/scripts/seedLinkingDepartmentsHeadOfUnit.js", label: "Head of Unit & Linking Dept accounts" },
  { script: "src/scripts/seedDirectorEnforcement.js", label: "Director Enforcement (HOD-0003)", demoOnly: true },
  { script: "src/scripts/seedServicomIndicators.js", label: "SERVICOM indicators" },
  { script: "src/scripts/seedServicomData.js", label: "SERVICOM sample data" },
  { script: "src/scripts/seedComplaintSla.js", label: "Complaint SLA rules + demo complaints" },
  { script: "src/scripts/seedEnforcementDashboardDemo.js", label: "Enforcement dashboard (compliance + complaints)" },
  { script: "src/scripts/seedStateOfficeData.js", label: "State Office sample data" },
  { script: "src/scripts/seedAccreditedProviders.js", label: "Accredited HMO & HCF (from nhia.gov.ng)" },
  { script: "src/scripts/seedHcfMasterFacilities.js", label: "HCF Master facilities (Excel)" },
  { script: "src/scripts/seedHmoProviders.js", label: "Accredited HMOs (Excel June 2025)" },
  { script: "src/scripts/seedStoreManagement.js", label: "Store / Asset Management sample data" },
  { script: "src/scripts/seedAdminHr.js", label: "Admin / HR sample reports" },
];

const INCREMENTAL_MIGRATE_STEPS = [
  { script: "src/scripts/migrateRoles.js", label: "Roles" },
  { script: "src/scripts/legacy/addComplianceManagement.js", label: "Compliance tables" },
  { script: "src/scripts/legacy/migrateStateOfficeReports.js", label: "State Office tables" },
  { script: "src/scripts/legacy/migrateCompliancePrivileges.js", label: "Compliance privileges" },
  { script: "src/scripts/legacy/migrateSocZonesPrivileges.js", label: "SOC/Zones privileges" },
  { script: "src/scripts/legacy/addMonthlyEnrolleeRegister.js", label: "Monthly Enrollee Register table" },
  { script: "src/scripts/legacy/addEtmcTmcActionPoint.js", label: "ETMC/TMC Action-Point Register tables" },
  { script: "src/scripts/legacy/addBeneficiaryManagement.js", label: "Beneficiary Management tables" },
  { script: "src/scripts/legacy/migrateOthersPrivileges.js", label: "Zonal module privileges" },
  { script: "src/scripts/legacy/migrateSectionDashboards.js", label: "Section dashboards privileges" },
  { script: "src/scripts/updateStoreDb.js", label: "Store / Asset Management schema" },
  { script: "src/scripts/updateAdminHrDb.js", label: "Admin / HR reports schema" },
];

const steps = seedsOnly
  ? [...INCREMENTAL_MIGRATE_STEPS, ...SEED_STEPS]
  : [...MIGRATE_STEPS, ...SEED_STEPS];

function runStep(step) {
  console.log(`\n── ${step.label} ──`);
  if (step.demoOnly && !demoUsers) {
    console.log("ℹ️   Skipped (pass --demo-users to seed demo accounts)\n");
    return;
  }
  const args = [step.script];
  if (step.forwardDemo && demoUsers) args.push("--demo-users");
  const result = spawnSync(node, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n❌  Stopped at: ${step.label}`);
    process.exit(result.status || 1);
  }
}

console.log(seedsOnly
  ? "🌱  NHIA URMS — incremental seed run (migrations + missing data only)\n"
  : "🌱  NHIA URMS — sync, migrate & seed\n");

for (const step of steps) {
  runStep(step);
}

console.log("\n🎉  All steps completed (existing data was left unchanged)\n");
if (!seedsOnly) {
  console.log("  Admin login:  staff_id ADMIN001  /  password Admin@1234");
  console.log("  Demo users:   password Nhia@2025  (see docs/DATABASE.md)");
  console.log("  HCF dropdown: accredited facilities seeded per state (Compliance & Complaints)\n");
}
process.exit(0);
