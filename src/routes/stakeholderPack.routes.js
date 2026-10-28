const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload: beneficiaryUpload } = require("../middleware/beneficiaryUpload");
const ctrl = require("../controllers/stakeholderPack.controller");

const router = express.Router();
router.use(authenticate);
router.get("/reports", ctrl.listReports);
router.get("/reports/:id", ctrl.getReport);
router.post("/reports", ctrl.createReport);
router.put("/reports/:id", ctrl.updateReport);
router.patch("/reports/:id/status", ctrl.updateStatus);
router.post(
  "/reports/:id/lines/:lineId/files",
  beneficiaryUpload.array("files", 10),
  ctrl.uploadLineFiles,
);

module.exports = router;
