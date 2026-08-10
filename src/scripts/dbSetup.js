/**
 * Fresh database setup — the only command you need for a new database.
 *
 *   npm run db:setup
 *
 * 1. Creates / updates all tables from Sequelize models
 * 2. Seeds roles, zones, states, departments, demo users, and sample data
 *
 * Safe to re-run: existing rows are left unchanged (idempotent seeds).
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;

function run(script, label) {
  console.log(`\n══ ${label} ══\n`);
  const result = spawnSync(node, [script], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\n❌  Setup stopped at: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log("🚀  NHIA URMS — database setup\n");
console.log("This will sync the schema and load reference + demo data.\n");

run("src/scripts/syncDb.js", "Step 1 — Sync tables");
run("src/scripts/seedAll.js", "Step 2 — Seed data");

console.log("\n🎉  Database ready!\n");
console.log("  Admin login:  staff_id ADMIN001  /  password Admin@1234");
console.log("  Demo users:   password Nhia@2025  (see docs/DATABASE.md)\n");
process.exit(0);
