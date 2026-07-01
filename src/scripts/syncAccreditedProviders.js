/**
 * Pull accredited HMO + HCP lists from nhia.gov.ng into nhia_accredited_providers.
 * Requires outbound HTTPS from the server.
 *
 * Run: npm run db:sync-accredited-providers
 */
require("dotenv").config();
const sequelize = require("../config/database");
const { syncFromNhia } = require("../services/nhiaAccreditationSync");
const { syncStateOfficeTables } = require("./stateOfficeTableSync");
const models = require("../models");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    await syncStateOfficeTables(sequelize, models);
    console.log("📦  nhia_accredited_providers table ready");
    console.log("🌐  Fetching HMO + HCP from nhia.gov.ng (may take a minute)...");

    const result = await syncFromNhia();
    console.log(`✅  Synced ${result.hmoCount} HMO(s) and ${result.hcpCount} HCP(s) (${result.total} total)`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Sync failed:", err.message);
    console.error("   Ensure the server can reach https://www.nhia.gov.ng");
    process.exit(1);
  }
})();
