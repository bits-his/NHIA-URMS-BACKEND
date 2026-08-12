/**
 * Update Store / Asset Management schema (idempotent).
 *
 * Syncs store tables and expands physical verification condition values
 * (Defective, Obsolete, Retired) used by Physical Asset Verification.
 *
 *   npm run db:update-store
 *   node src/scripts/updateStoreDb.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const {
  StoreAsset,
  StoreInventoryItem,
  GoodsReceiptNote,
  StockIssueVoucher,
  AssetTransfer,
  SupplyVerification,
  AssetMaintenance,
  AssetDisposal,
  PhysicalAssetVerification,
  PhysicalAssetVerificationItem,
  StockConversion,
} = require("../models");

const CONDITION_ENUM =
  "ENUM('GOOD','FAIR','POOR','MISSING','DAMAGED','DEFECTIVE','OBSOLETE','RETIRED') NOT NULL DEFAULT 'GOOD'";

async function alterConditionEnum() {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'physical_asset_verification_items'
       AND COLUMN_NAME = 'condition'`
  );
  if (!rows.length) {
    console.log("⏭   physical_asset_verification_items.condition not found (table will be created by sync)");
    return;
  }
  const current = String(rows[0].COLUMN_TYPE || "");
  if (current.includes("OBSOLETE") && current.includes("RETIRED") && current.includes("DEFECTIVE")) {
    console.log("⏭   condition ENUM already includes Defective / Obsolete / Retired");
    return;
  }
  await sequelize.query(
    `ALTER TABLE physical_asset_verification_items MODIFY COLUMN \`condition\` ${CONDITION_ENUM}`
  );
  console.log("✅  Expanded physical_asset_verification_items.condition ENUM");
}

async function syncModel(Model, name) {
  try {
    await Model.sync({ alter: true });
    console.log(`✅  ${name}`);
  } catch (err) {
    const msg = String(err.message || err).split("\n")[0];
    console.log(`⚠️   ${name} alter skipped — ${msg}`);
    try {
      await Model.sync();
    } catch (err2) {
      console.log(`⚠️   ${name} create skipped — ${String(err2.message || err2).split("\n")[0]}`);
    }
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    await syncModel(StoreAsset, "store_assets");
    await syncModel(StoreInventoryItem, "store_inventory_items");
    await syncModel(GoodsReceiptNote, "goods_receipt_notes");
    await syncModel(StockIssueVoucher, "stock_issue_vouchers");
    await syncModel(AssetTransfer, "asset_transfers");
    await syncModel(SupplyVerification, "supply_verifications");
    await syncModel(AssetMaintenance, "asset_maintenances");
    await syncModel(AssetDisposal, "asset_disposals");
    await syncModel(PhysicalAssetVerification, "physical_asset_verifications");
    await syncModel(PhysicalAssetVerificationItem, "physical_asset_verification_items");
    await syncModel(StockConversion, "stock_conversions");
    console.log("✅  Store Management tables synced");

    await alterConditionEnum();

    console.log("\n🎉  Store DB update complete");
    console.log("    Next: npm run db:seed-store\n");
    process.exit(0);
  } catch (err) {
    console.error("❌  Store DB update failed:", err.message || err);
    process.exit(1);
  }
})();
