const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/storePack.controller");

router.use(authenticate);

router.get("/dashboard", ctrl.dashboard);

router.get("/inventory/items", ctrl.listInventory);
router.get("/inventory/items/:id/movements", ctrl.listItemMovements);
router.get("/inventory/items/:id", ctrl.getInventory);
router.post("/inventory/items", ctrl.createInventory);

router.get("/prepayment-analysis", ctrl.listPrepayments);
router.get("/prepayment-analysis/:id", ctrl.getPrepayment);
router.post("/prepayment-analysis", ctrl.createPrepayment);

router.get("/stores/issues", ctrl.listIssues);
router.post("/stores/issues", ctrl.createIssue);
/** Sidebar "Issuance" path uses transfers/requests in FE; map to same issue handlers */
router.get("/transfers", ctrl.listIssues);
router.get("/transfers/requests", ctrl.listIssues);
router.post("/transfers", ctrl.createIssue);
router.post("/transfers/requests", ctrl.createIssue);

router.get("/assets", ctrl.listAssets);
router.get("/assets/:id", ctrl.getAsset);
router.post("/assets", ctrl.createAsset);
router.put("/assets/:id", ctrl.updateAsset);

router.get("/verification/physical", ctrl.listPav);
router.get("/verification/physical/:id", ctrl.getPav);
router.post("/verification/physical", ctrl.createPav);
router.put("/verification/physical/:id", ctrl.updatePav);

/** Soft stubs for retired capitalisation / misc screens still linked in FE */
const emptyList = (_req, res) => res.json({ success: true, data: [] });
const notSupported = (_req, res) =>
  res.status(501).json({ success: false, message: "Not used in the simplified store pack (no capitalisation)." });
router.get("/inventory/conversions", emptyList);
router.post("/inventory/capitalise", notSupported);
router.get("/verification/supply", emptyList);
/** Legacy supply-verification create → prepayment IN */
router.post("/verification/supply", ctrl.createPrepayment);
router.get("/inventory/receipts", emptyList);
router.get("/maintenance", emptyList);
router.get("/disposal", emptyList);

module.exports = router;
