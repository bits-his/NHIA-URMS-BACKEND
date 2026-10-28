/**
 * Mounts /api/state-office/enrolment-drive-{key}/reports for each drive type.
 * Export a function that registers all segments onto an Express app/router.
 */
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload: beneficiaryUpload } = require("../middleware/beneficiaryUpload");
const {
  controllersBySegment,
  ENROLMENT_DRIVE_TYPES,
} = require("../controllers/enrolmentDrivePack.controller");

function buildDriveRouter(ctrl) {
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
  return router;
}

/** Register all enrolment-drive-* mounts on the Express app. */
function mountEnrolmentDrivePack(app) {
  for (const t of ENROLMENT_DRIVE_TYPES) {
    const ctrl = controllersBySegment[t.segment];
    if (!ctrl) continue;
    app.use(`/api/state-office/${t.segment}`, buildDriveRouter(ctrl));
  }
}

module.exports = { mountEnrolmentDrivePack, buildDriveRouter };
