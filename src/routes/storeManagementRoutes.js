const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const storeCtrl = require("../controllers/storeManagementController");

router.use(authenticate);

// Assets
router.get("/assets", storeCtrl.getAssets);
router.get("/assets/:id", storeCtrl.getAssetById);
router.post("/assets", storeCtrl.createAsset);
router.put("/assets/:id", storeCtrl.updateAsset);
router.delete("/assets/:id", storeCtrl.deleteAsset);

// Inventory Items
router.get("/inventory/items", storeCtrl.getInventoryItems);
router.post("/inventory/items", storeCtrl.createInventoryItem);

// Goods Receipts (GRN)
router.get("/inventory/receipts", storeCtrl.getGoodsReceipts);
router.post("/inventory/receipts", storeCtrl.createGoodsReceipt);

// Stock Issue Vouchers
router.get("/stores/issues", storeCtrl.getStockIssues);
router.post("/stores/issues", storeCtrl.createStockIssue);

// Transfers
router.get("/transfers", storeCtrl.getTransfers);
router.post("/transfers", storeCtrl.createTransfer);
router.put("/transfers/:id", storeCtrl.updateTransfer);

// Supply Verifications
router.get("/verification/supply", storeCtrl.getSupplyVerifications);
router.get("/verification/supply/:id", storeCtrl.getSupplyVerificationById);
router.post("/verification/supply", storeCtrl.createSupplyVerification);

// Maintenance & Disposal
router.get("/maintenance", storeCtrl.getMaintenance);
router.post("/maintenance", storeCtrl.createMaintenance);
router.get("/disposal", storeCtrl.getDisposals);
router.post("/disposal", storeCtrl.createDisposal);

module.exports = router;
