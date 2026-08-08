/**
 * Pull accredited HMO + HCP lists from nhia.gov.ng into nhia_accredited_providers.
 * Requires outbound HTTPS from the server.
 *
 * Run:
 *   npm run db:sync-accredited-providers
 *   npm run db:sync-accredited-providers -- --force
 */
require("dotenv").config();
const sequelize = require("../config/database");
const { syncFromNhia } = require("../services/nhiaAccreditationSync");
const { syncStateOfficeTables } = require("./stateOfficeTableSync");
const { NhiaAccreditedProvider } = require("../models");
const models = require("../models");

const force = process.argv.includes("--force");

const onProgress = (evt) => {
  if (evt.stage === "hmo" && evt.message) console.log(`🌐  ${evt.message}`);
  if (evt.stage === "hmo" && evt.fetched != null) console.log(`   ↳ ${evt.fetched} HMO record(s) parsed`);
  if (evt.stage === "hcp" && evt.chunk != null) {
    console.log(`   ↳ HCP chunk ${evt.chunk}: ${evt.chunkRows} rows (${evt.total} total so far)`);
  }
  if (evt.stage === "hcp" && evt.fetched != null) console.log(`   ↳ ${evt.fetched} HCP record(s) parsed`);
  if (evt.stage === "upsert" && evt.message) console.log(`💾  ${evt.message}`);
  if (evt.stage === "upsert" && evt.processed != null && evt.total != null) {
    process.stdout.write(`\r   ↳ Saved ${evt.processed}/${evt.total}`);
    if (evt.processed >= evt.total) process.stdout.write("\n");
  }
};

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    await syncStateOfficeTables(sequelize, models);
    console.log("📦  nhia_accredited_providers table ready");

    const before = await NhiaAccreditedProvider.count();
    if (before > 0 && !force) {
      const hmo = await NhiaAccreditedProvider.count({ where: { provider_type: "hmo" } });
      const hcp = await NhiaAccreditedProvider.count({ where: { provider_type: "hcp" } });
      console.log(`ℹ️  Table already has ${before} record(s) (${hmo} HMO, ${hcp} HCP).`);
      console.log("   Re-run with --force to refresh from nhia.gov.ng.");
      process.exit(0);
    }

    if (force && before > 0) {
      console.log(`🔄  Force refresh — updating existing ${before} record(s) from nhia.gov.ng`);
    } else {
      console.log("🌐  Fetching HMO + HCP from nhia.gov.ng (may take a minute)...");
    }

    const result = await syncFromNhia(onProgress);
    console.log(`\n✅  Sync complete`);
    console.log(`   Fetched & upserted: ${result.hmoCount} HMO, ${result.hcpCount} HCP (${result.total} total)`);
    console.log(`   Database now has:   ${result.dbHmo} HMO, ${result.dbHcp} HCP (${result.dbTotal} total)`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Sync failed:", err.message);
    console.error("   Ensure the server can reach https://www.nhia.gov.ng");
    process.exit(1);
  }
})();
