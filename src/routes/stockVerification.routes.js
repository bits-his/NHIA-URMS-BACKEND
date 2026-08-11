const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const {
  getZones, getStates, getDepartments, getUnits,
  getAssets, createAsset, updateAsset, setAssetStatus,
  createVerification, listVerifications, getVerification,
  updateVerification, updateStatus, getDashboard, getDashboardDrill,
} = require("../controllers/stockVerification.controller");

const router = Router();

router.use(authenticate);

// ── Lookup routes ─────────────────────────────────────────────────────────────
router.get("/zones",       getZones);
router.get("/states",      getStates);
router.get("/departments", getDepartments);
router.get("/units",       getUnits);

// ── Asset CRUD ────────────────────────────────────────────────────────────────
router.get("/assets",      getAssets);
router.post("/assets",     createAsset);
router.put("/assets/:id",  updateAsset);
router.patch("/assets/:id/status",
  body("is_active").custom((v) => typeof v === "boolean").withMessage("is_active must be true or false"),
  validate,
  setAssetStatus
);

// ── Verification CRUD ─────────────────────────────────────────────────────────
const verificationRules = [
  body("zone_id").notEmpty().withMessage("Zone is required"),
  body("state_id").notEmpty().withMessage("State is required"),
  body("stocktaking_type")
    .isIn(["annual","monthly","periodic","surprise"])
    .withMessage("Invalid stocktaking type"),
];

router.get("/dashboard", getDashboard);
router.get("/dashboard/drill", getDashboardDrill);

router.get("/verifications",          listVerifications);
router.get("/verifications/:id",      getVerification);
router.post("/verifications",         verificationRules, validate, createVerification);
router.put("/verifications/:id",      verificationRules, validate, updateVerification);
router.patch("/verifications/:id/status",
  body("status").notEmpty(), validate, updateStatus
);

module.exports = router;
