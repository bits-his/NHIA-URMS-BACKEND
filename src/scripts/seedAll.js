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
];

const SEED_STEPS = [
  { script: "src/scripts/seedZonesStates.js", label: "Zones & states" },
  { script: "src/scripts/seedDepartmentsUnits.js", label: "Departments & units" },
  { script: "src/scripts/seedUsers.js", label: "Demo users" },
  { script: "src/scripts/seedServicomIndicators.js", label: "SERVICOM indicators" },
  { script: "src/scripts/seedServicomData.js", label: "SERVICOM sample data" },
  { script: "src/scripts/seedStateOfficeData.js", label: "State Office sample data" },
  { script: "src/scripts/seedAccreditedProviders.js", label: "Accredited HMO & HCF (from nhia.gov.ng)" },
];

const INCREMENTAL_MIGRATE_STEPS = [
  { script: "src/scripts/migrateRoles.js", label: "Roles" },
  { script: "src/scripts/legacy/addComplianceManagement.js", label: "Compliance tables" },
  { script: "src/scripts/legacy/migrateStateOfficeReports.js", label: "State Office tables" },
  { script: "src/scripts/legacy/migrateCompliancePrivileges.js", label: "Compliance privileges" },
  { script: "src/scripts/legacy/migrateSocZonesPrivileges.js", label: "SOC/Zones privileges" },
];

const steps = seedsOnly
  ? [...INCREMENTAL_MIGRATE_STEPS, ...SEED_STEPS]
  : [...MIGRATE_STEPS, ...SEED_STEPS];

function runStep(step) {
  console.log(`\n── ${step.label} ──`);
  const result = spawnSync(node, [step.script], {
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
