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

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    await StoreAsset.sync({ alter: true });
    await StoreInventoryItem.sync({ alter: true });
    await GoodsReceiptNote.sync({ alter: true });
    await StockIssueVoucher.sync({ alter: true });
    await AssetTransfer.sync({ alter: true });
    await SupplyVerification.sync({ alter: true });
    await AssetMaintenance.sync({ alter: true });
    await AssetDisposal.sync({ alter: true });
    await PhysicalAssetVerification.sync({ alter: true });
    await PhysicalAssetVerificationItem.sync({ alter: true });
    await StockConversion.sync({ alter: true });

    console.log("✅  Store Management tables created / synced successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌  Sync Store DB failed:", err);
    process.exit(1);
  }
})();
