/**
 * Sync ONLY core + approved-form tables. Never recreates legacy report tables.
 * Usage: npm run db:sync:active
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { syncActiveSchema, allActiveModels } = require("../../models/active");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    console.log(`Syncing ${allActiveModels().length} active models…`);
    await syncActiveSchema({ alter: true });
    console.log("✅  Active schema synced (legacy tables NOT touched/created)");
    process.exit(0);
  } catch (err) {
    console.error("❌  Active sync failed:", err);
    process.exit(1);
  }
})();
