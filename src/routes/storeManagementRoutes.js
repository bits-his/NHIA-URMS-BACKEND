const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const storeCtrl = require("../controllers/storeManagementController");
const { upload } = require("../middleware/storeUpload");

function optionalAwardUpload(req, res, next) {
  if (req.is("multipart/form-data")) {
    return upload.single("awardLetter")(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      next();
    });
  }
  next();
}

router.use(authenticate);

// Assets
router.get("/assets", storeCtrl.getAssets);
router.get("/assets/:id", storeCtrl.getAssetById);
router.post("/assets", storeCtrl.createAsset);
router.put("/assets/:id", storeCtrl.updateAsset);
router.delete("/assets/:id", storeCtrl.deleteAsset);

// Inventory Items
router.get("/inventory/items", storeCtrl.getInventoryItems);
router.get("/inventory/items/:id/movements", storeCtrl.getInventoryMovements);
router.get("/inventory/items/:id", storeCtrl.getInventoryItemById);
router.post("/inventory/items", storeCtrl.createInventoryItem);
router.get("/inventory/conversions", storeCtrl.getConversions);
router.post("/inventory/capitalise", storeCtrl.capitaliseInventory);

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

// Physical Asset Verification (audit of Master Register assets)
router.get("/verification/physical", storeCtrl.getPhysicalVerifications);
router.get("/verification/physical/:id", storeCtrl.getPhysicalVerificationById);
router.post("/verification/physical", storeCtrl.createPhysicalVerification);
router.put("/verification/physical/:id", storeCtrl.updatePhysicalVerification);

// Prepayment Analysis Register
router.get("/prepayment-analysis", storeCtrl.getPrepaymentAnalyses);
router.get("/prepayment-analysis/:id", storeCtrl.getPrepaymentAnalysisById);
router.post("/prepayment-analysis", optionalAwardUpload, storeCtrl.createPrepaymentAnalysis);
router.put("/prepayment-analysis/:id", optionalAwardUpload, storeCtrl.updatePrepaymentAnalysis);

// Maintenance & Disposal
router.get("/maintenance", storeCtrl.getMaintenance);
router.post("/maintenance", storeCtrl.createMaintenance);
router.get("/disposal", storeCtrl.getDisposals);
router.post("/disposal", storeCtrl.createDisposal);

module.exports = router;
