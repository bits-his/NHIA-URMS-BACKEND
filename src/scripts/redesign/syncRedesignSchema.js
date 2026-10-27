/**
 * Create / alter redesign platform tables only (does not touch legacy report tables).
 * Usage: npm run db:redesign:sync
 */
require("dotenv").config();
const sequelize = require("../../config/database");

// Ensure legacy org tables exist for FKs
require("../../models/index");
const redesign = require("../../models/redesign");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    const models = Object.values(redesign);
    for (const model of models) {
      await model.sync({ alter: true });
      console.log(`  synced ${model.tableName}`);
    }

    console.log(`✅  Redesign schema synced (${models.length} models)`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Redesign sync failed:", err);
    process.exit(1);
  }
})();
