/**
 * Consolidated master seed command for all rebuilt & active database packs:
 * - Office Profile Hub (Forms 1, 2, 3, 4)
 * - Enrolment Drives & Campaigns
 * - Beneficiary Management
 * - Stakeholder Management
 * - Provider Management
 * - Weekly Compliance Report
 * - HMO Indebtedness & Reconciliation
 * - Store & Physical Asset Verification
 * - Enrolment Activity Reporting
 * - Master Providers (HMO, HCF, Accredited) & Geographic Master Data
 *
 * Usage:
 *   npm run db:seed:rebuilt
 *   or: node src/scripts/seedRebuiltPacks.js
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;

const SEED_SCRIPTS = [
  { script: "src/scripts/seedZonesStates.js", label: "Geographic Zones & States" },
  { script: "src/scripts/seedDepartmentsUnits.js", label: "Departments & Units" },
  { script: "src/scripts/seedAccreditedProviders.js", label: "NHIA Accredited Providers" },
  { script: "src/scripts/seedHcfMasterFacilities.js", label: "Healthcare Facilities Master" },
  { script: "src/scripts/seedHmoProviders.js", label: "HMO Providers Master" },
  { script: "src/scripts/seedEnrolmentDemo.js", label: "Enrolment Activity Reporting Pack" },
  { script: "src/scripts/seedEnrolmentDriveDemo.js", label: "Enrolment Drive Workflow & Batches" },
  { script: "src/scripts/seedBeneficiaryDemo.js", label: "Beneficiary Management Pack" },
  { script: "src/scripts/seedStakeholderDemo.js", label: "Stakeholder Management Pack" },
  { script: "src/scripts/seedProviderManagementDemo.js", label: "Provider Management Pack" },
  { script: "src/scripts/seedWeeklyCompliance.js", label: "Weekly Compliance Pack" },
  { script: "src/scripts/seedHmoIndebtednessDemo.js", label: "HMO Indebtedness & Recon Pack" },
  { script: "src/scripts/seedStorePackDemo.js", label: "Store & Asset Verification Pack" },
  { script: "src/scripts/seedOfficeProfileDemo.js", label: "Office Profile Hub (Forms 1, 2, 3, 4)" },
];

async function main() {
  console.log("================================================================================");
  console.log("  NHIA URMS — SEEDING ALL REBUILT AND ACTIVE DATABASE PACKS");
  console.log("================================================================================");

  let successCount = 0;
  let failCount = 0;

  for (const item of SEED_SCRIPTS) {
    process.stdout.write(`⏳ Seeding: ${item.label}... `);
    const fullPath = path.join(ROOT, item.script);

    const res = spawnSync(node, [fullPath], {
      cwd: ROOT,
      env: process.env,
      stdio: "pipe",
      encoding: "utf-8",
    });

    if (res.status === 0) {
      console.log("✅ DONE");
      successCount++;
    } else {
      console.log("❌ FAILED");
      console.error(res.stderr || res.stdout);
      failCount++;
    }
  }

  console.log("================================================================================");
  if (failCount === 0) {
    console.log(`🎉 SUCCESS: All ${successCount} database packs seeded successfully!`);
  } else {
    console.warn(`⚠️ Finished with ${successCount} succeeded and ${failCount} failed.`);
  }
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});

