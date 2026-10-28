/**
 * Lean setup for fresh start (org/auth + Citizens' Comment Cards).
 *
 *   npm run db:seed-all
 *   npm run db:seed         — same seeds only (no full syncDb)
 *   npm run db:setup        — same as db:seed-all
 *
 * Keeps/reseeds: zones, states, departments, units, roles, users, nhia_db3 comment-card schema.
 * Does NOT seed SERVICOM/store/state-office demo datasets.
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;
const seedsOnly = process.argv.includes("--seeds-only");
const demoUsers = process.argv.includes("--demo-users");

const MIGRATE_STEPS = [
  { script: "src/scripts/syncDb.js", label: "Sync schema (tables)" },
  { script: "src/scripts/migrateRoles.js", label: "Roles" },
  { script: "src/scripts/setupCommentCardDb.js", label: "Citizens' Comment Cards DB (nhia_db3)" },
];

const SEED_STEPS = [
  { script: "src/scripts/seedZonesStates.js", label: "Zones & states" },
  { script: "src/scripts/seedDepartmentsUnits.js", label: "Departments & units" },
  { script: "src/scripts/seedUsers.js", label: "Users", forwardDemo: true },
];

const INCREMENTAL_MIGRATE_STEPS = [
  { script: "src/scripts/migrateRoles.js", label: "Roles" },
  { script: "src/scripts/setupCommentCardDb.js", label: "Citizens' Comment Cards DB (nhia_db3)" },
];

const steps = seedsOnly
  ? [...INCREMENTAL_MIGRATE_STEPS, ...SEED_STEPS]
  : [...MIGRATE_STEPS, ...SEED_STEPS];

function runStep(step) {
  console.log(`\n── ${step.label} ──`);
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
  ? "🌱  NHIA URMS — lean seed (org/auth + comment cards)\n"
  : "🌱  NHIA URMS — lean sync & seed (org/auth + comment cards)\n");

for (const step of steps) {
  runStep(step);
}

console.log("\n🎉  Lean setup complete\n");
console.log("  Kept/seeded: zones, states, departments, units, roles, users");
console.log("  Comment cards: nhia_db3 schema + Q01–Q05 (no sample cards)");
console.log("  Admin login:  staff_id ADMIN001  /  password Admin@1234\n");
console.log("  To wipe non-org data again: npm run db:reset-fresh-start\n");
process.exit(0);
