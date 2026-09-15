/**
 * Update Store / Asset Management schema (idempotent).
 *
 * Syncs store tables and expands physical verification condition values
 * (Defective, Obsolete, Retired) used by Physical Asset Verification.
 *
 *   npm run db:update-store
 *   node src/scripts/updateStoreDb.js
 *
 * Note: MariaDB + Sequelize `sync({ alter: true })` can fail on JSON columns
 * that have `json_valid(...)` CHECK constraints. This script falls back to
 * raw, idempotent ALTERs for those tables.
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
  PrepaymentAnalysis,
} = require("../models");

const CONDITION_ENUM =
  "ENUM('GOOD','FAIR','POOR','MISSING','DAMAGED','DEFECTIVE','OBSOLETE','RETIRED') NOT NULL DEFAULT 'GOOD'";

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table
       AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  return Number(rows[0].cnt) > 0;
}

async function dropCheckConstraint(table, constraintName) {
  try {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND TABLE_NAME = :table
         AND CONSTRAINT_NAME = :name
         AND CONSTRAINT_TYPE = 'CHECK'`,
      { replacements: { table, name: constraintName } }
    );
    if (Number(rows[0].cnt) === 0) return false;
    await sequelize.query(
      `ALTER TABLE \`${table}\` DROP CONSTRAINT \`${constraintName}\``
    );
    console.log(`✅  Dropped CHECK ${table}.${constraintName}`);
    return true;
  } catch (err) {
    console.log(`⚠️   Could not drop CHECK ${table}.${constraintName} — ${String(err.message || err).split("\n")[0]}`);
    return false;
  }
}

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

async function ensureStoreAssetComments() {
  if (await columnExists("store_assets", "comments")) {
    console.log("⏭   store_assets.comments already exists");
    return;
  }

  // MariaDB can fail ALTER on store_assets while a json_valid CHECK exists on
  // category_attributes (Sequelize reports: Unknown column storeasset.category_attributes in CHECK).
  await dropCheckConstraint("store_assets", "category_attributes");

  await sequelize.query(
    `ALTER TABLE store_assets ADD COLUMN comments TEXT NULL`
  );
  console.log("✅  Added store_assets.comments");
}

async function syncModel(Model, name, { skipAlter = false } = {}) {
  try {
    if (skipAlter) {
      await Model.sync();
      console.log(`✅  ${name} (create-if-missing)`);
      return;
    }
    await Model.sync({ alter: true });
    console.log(`✅  ${name}`);
  } catch (err) {
    const msg = String(err.message || err).split("\n")[0];
    console.log(`⚠️   ${name} alter skipped — ${msg}`);
    try {
      await Model.sync();
      console.log(`✅  ${name} (create-if-missing)`);
    } catch (err2) {
      console.log(`⚠️   ${name} create skipped — ${String(err2.message || err2).split("\n")[0]}`);
    }
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    // Avoid alter on tables with JSON CHECKs that break MariaDB ALTER
    await dropCheckConstraint("store_assets", "category_attributes");
    await syncModel(StoreAsset, "store_assets", { skipAlter: true });
    await ensureStoreAssetComments();

    await syncModel(StoreInventoryItem, "store_inventory_items");
    await syncModel(GoodsReceiptNote, "goods_receipt_notes");
    await syncModel(StockIssueVoucher, "stock_issue_vouchers", { skipAlter: true });
    await syncModel(AssetTransfer, "asset_transfers");
    await syncModel(SupplyVerification, "supply_verifications", { skipAlter: true });
    await syncModel(AssetMaintenance, "asset_maintenances");
    await syncModel(AssetDisposal, "asset_disposals");
    await syncModel(PhysicalAssetVerification, "physical_asset_verifications");
    await syncModel(PhysicalAssetVerificationItem, "physical_asset_verification_items");
    await syncModel(StockConversion, "stock_conversions");
    await syncModel(PrepaymentAnalysis, "prepayment_analyses");
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
