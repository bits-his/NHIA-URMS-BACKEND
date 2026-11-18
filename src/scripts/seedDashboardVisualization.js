/**
 * Master seed for app dashboards — enough realistic rows for every chart and
 * KPI to paint, without flooding the database.
 *
 * Covers:
 *   Enrolment Activity, Enrolment Drives, GIFSHIP renewals,
 *   Provider Management, Stakeholder, Beneficiary, Challenges & Support,
 *   Finance, SERVICOM, Stock / assets, role / enforcement dashboards.
 *
 *   node src/scripts/seedDashboardVisualization.js
 *   npm run db:seed-dashboard-viz
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;

const STEPS = [
  { script: "src/scripts/seedZonesStates.js", label: "Zones & states", required: true },
  { script: "src/scripts/seedEnrolmentDashboardDemo.js", label: "Enrolment Activity dashboard", required: true },
  { script: "src/scripts/seedEnrolmentRenewalsDemo.js", label: "GIFSHIP renewals", required: false },
  { script: "src/scripts/seedEnrolmentDriveDemo.js", label: "Enrolment Drives dashboard", required: false },
  { script: "src/scripts/seedDashboardDemo.js", label: "Stakeholder / Beneficiary / Challenges / Provider", required: false },
  { script: "src/scripts/seedFinanceDemo.js", label: "Finance (IGR / SSHIA / Expenditure)", required: false },
  { script: "src/scripts/seedServicomDashboardDemo.js", label: "SERVICOM dashboard", required: false },
  { script: "src/scripts/seedStoreDashboardDemo.js", label: "Store assets dashboard", required: false },
  { script: "src/scripts/seedStorePackDemo.js", label: "Store pack & verifications", required: false },
  { script: "src/scripts/seedEnforcementDashboardDemo.js", label: "Enforcement dashboard", required: false },
  { script: "src/scripts/seedRoleDashboardDemo.js", label: "Role dashboards (SC / Zonal / SDO / DG)", required: false },
  { script: "src/scripts/seedOfficeProfileDemo.js", label: "Office profile", required: false },
];

function run(step) {
  process.stdout.write(`\n── ${step.label} ──\n`);
  const result = spawnSync(node, [step.script], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    if (step.required) {
      console.error(`\nStopped — required step failed: ${step.label}`);
      process.exit(result.status || 1);
    }
    console.warn(`Skipped after failure: ${step.label}`);
    return false;
  }
  return true;
}

console.log("NHIA URMS — dashboard visualization seed");
console.log("Moderate volume so every dashboard panel has something to show.\n");

let ok = 0;
let skipped = 0;
for (const step of STEPS) {
  if (run(step)) ok += 1;
  else skipped += 1;
}

console.log(`\nDone. ${ok} steps succeeded${skipped ? `, ${skipped} skipped` : ""}.`);
console.log("Open State Office Dashboard → Enrolment / Enrolment Drives / Provider / Finance / Challenges to review.");
process.exit(0);
