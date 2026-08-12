/**
 * Run all privilege migrations needed after deploying SOC/Zonal/SDO sidebar changes.
 *
 * Run on production after git pull:
 *   node src/scripts/legacy/migrateProductionAccess.js
 */
require("dotenv").config();

const { execSync } = require("child_process");
const path = require("path");

const scripts = [
  "migrateSocZonesPrivileges.js",
  "migrateOthersPrivileges.js",
  "migrateSectionDashboards.js",
];

const dir = __dirname;

for (const file of scripts) {
  const full = path.join(dir, file);
  console.log(`\n── ${file} ──`);
  execSync(`node "${full}"`, { stdio: "inherit", cwd: path.join(dir, "../../..") });
}

console.log("\n✅  Production access migrations complete");
