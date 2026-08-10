/**
 * Seed all reference + demo data (idempotent — skips existing rows).
 *
 * Prefer: npm run db:setup   (sync + seed in one step)
 * Or:     npm run db:seed    (seed only, after db:sync)
 *
 * See docs/DATABASE.md for the full list of what each step loads.
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;

const STEPS = [
  { script: "src/scripts/migrateRoles.js", label: "Roles" },
  { script: "src/scripts/seedZonesStates.js", label: "Zones & states" },
  { script: "src/scripts/seedDepartmentsUnits.js", label: "Departments & units" },
  { script: "src/scripts/seedUsers.js", label: "Demo users" },
  { script: "src/scripts/seedServicomIndicators.js", label: "SERVICOM indicators" },
  { script: "src/scripts/seedServicomData.js", label: "SERVICOM sample data" },
  { script: "src/scripts/seedStateOfficeData.js", label: "State Office sample data" },
];

console.log("🌱  NHIA URMS — idempotent seed run\n");

for (const step of STEPS) {
  console.log(`\n── ${step.label} ──`);
  const result = spawnSync(node, [step.script], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n❌  Seed stopped at: ${step.label}`);
    process.exit(result.status || 1);
  }
}

console.log("\n🎉  All seed steps completed (existing data was left unchanged)\n");
process.exit(0);
