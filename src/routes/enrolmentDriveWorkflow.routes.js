const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload } = require("../middleware/enrolmentDriveUpload");
const ctrl = require("../controllers/enrolmentDriveWorkflow.controller");
const { hasDriveAccess, canAccessEnrolmentDriveDashboard } = require("../utils/enrolmentDriveWorkflow");

const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (!hasDriveAccess(req.user)) return res.status(403).json({ success: false, message: "Enrolment Drives access is required" });
  next();
});
router.get("/catalogue", ctrl.catalogue);
router.get("/analytics", (req, res, next) => {
  if (!canAccessEnrolmentDriveDashboard(req.user)) {
    return res.status(403).json({ success: false, message: "Enrolment Drives dashboard is limited to State Coordinator, Zonal Director, SDO and DG" });
  }
  return next();
}, ctrl.analytics);
router.get("/legacy", ctrl.legacy);
router.get("/actions", ctrl.listActions);
router.post("/actions", ctrl.saveAction);
router.put("/actions/:actionId", ctrl.saveAction);
router.post("/actions/:actionId/evidence", upload.array("files", 10), ctrl.uploadEvidence);
router.get("/evidence/:fileId", ctrl.downloadEvidence);
router.get("/batches", ctrl.listBatches);
router.post("/batches", ctrl.createBatch);
router.get("/batches/:id", ctrl.getBatch);
router.put("/batches/:id", ctrl.updateBatch);
router.post("/batches/:id/transition", ctrl.changeStatus);
router.post("/batches/:id/deadline", ctrl.setDeadline);
router.post("/batches/:id/activities", ctrl.createActivity);
router.post("/batches/:id/legacy/:driveId", ctrl.attachLegacy);
router.put("/activities/:driveId", ctrl.updateActivity);
router.post("/activities/:driveId/evidence", upload.array("files", 10), ctrl.uploadEvidence);
module.exports = router;
