/**
 * Create State Office report tables (idempotent, create-only — no ALTER).
 * Run: npm run db:migrate-state-office
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const models = require("../../models");
const { syncStateOfficeTables } = require("../stateOfficeTableSync");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    await syncStateOfficeTables(sequelize, models, { log: true });
    console.log("✅  State Office tables ready");
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
