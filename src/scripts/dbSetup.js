/**
 * Fresh database setup — sync, migrate, and seed in one command.
 *
 *   npm run db:setup
 *
 * Equivalent to: npm run db:seed-all
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const node = process.execPath;

console.log("🚀  NHIA URMS — database setup\n");
console.log("This will sync the schema, run migrations, and load reference + demo data.\n");

const result = spawnSync(node, ["src/scripts/seedAll.js"], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status || 0);
