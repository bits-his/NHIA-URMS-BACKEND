/**
 * Seed accredited HMO + HCF from nhia.gov.ng (official NHIA lists).
 *
 * Sources:
 *   HMO — https://www.nhia.gov.ng/hmo/
 *   HCP — https://www.nhia.gov.ng/hcps/ (Ninja Tables API)
 *
 * Idempotent: upserts by (provider_type, provider_code). Existing rows are updated
 * when NHIA data changes. Set NHIA_SKIP_PROVIDER_SYNC=1 to skip the network fetch.
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { NhiaAccreditedProvider } = require("../models");
const { syncFromNhia } = require("../services/nhiaAccreditationSync");

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

/** Remove old hard-coded demo rows superseded by NHIA sync (HMO-HYG, generic state hospitals). */
async function removeLegacyDemoProviders() {
  const hmoRemoved = await NhiaAccreditedProvider.destroy({
    where: {
      provider_type: "hmo",
      provider_code: { [Op.like]: "HMO-%" },
    },
  });

  const hcpRemoved = await NhiaAccreditedProvider.destroy({
    where: {
      provider_type: "hcp",
      name: { [Op.like]: "% State Hospital" },
      address: { [Op.like]: "% State, Nigeria" },
    },
  });

  return hmoRemoved + hcpRemoved;
}

async function runSeed() {
  await sequelize.authenticate();
  console.log("✅  DB connected");

  console.log("📦  Ensuring nhia_accredited_providers table...");
  await NhiaAccreditedProvider.sync();

  if (process.env.NHIA_SKIP_PROVIDER_SYNC === "1") {
    const hmoTotal = await NhiaAccreditedProvider.count({ where: { provider_type: "hmo" } });
    const hcfTotal = await NhiaAccreditedProvider.count({ where: { provider_type: "hcp" } });
    console.log("⏭️  NHIA_SKIP_PROVIDER_SYNC=1 — using existing provider data");
    console.log(`   HMO: ${hmoTotal}  |  HCF (facilities): ${hcfTotal}`);
    return { hmoTotal, hcfTotal, skipped: true };
  }

  console.log("\n🌐  Syncing HMO + HCF from nhia.gov.ng (may take ~30 seconds)...");
  const result = await syncFromNhia(onProgress);

  const legacyRemoved = await removeLegacyDemoProviders();
  if (legacyRemoved) console.log(`🧹  Removed ${legacyRemoved} legacy demo provider(s)`);

  console.log("\n✅  Accredited providers ready (NHIA official list)");
  console.log(`   Synced: ${result.hmoCount} HMO, ${result.hcpCount} HCP`);
  console.log(`   Database: ${result.dbHmo} HMO, ${result.dbHcp} HCF (${result.dbTotal} total)`);

  return {
    hmoTotal: result.dbHmo,
    hcfTotal: result.dbHcp,
    synced: true,
    ...result,
  };
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌  Accredited provider seed failed:", err.message);
      console.error("   Ensure the server can reach https://www.nhia.gov.ng");
      console.error("   Or set NHIA_SKIP_PROVIDER_SYNC=1 to keep existing data.");
      process.exit(1);
    });
}

module.exports = { runSeed, removeLegacyDemoProviders };
