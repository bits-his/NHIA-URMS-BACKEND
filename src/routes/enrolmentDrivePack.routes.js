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
  router.use((req, res, next) => {
    if (!require("../utils/enrolmentDriveWorkflow").hasDriveAccess(req.user)) return res.status(403).json({ success: false, message: "Enrolment Drives access is required" });
    if (req.method !== "GET") return res.status(409).json({ success: false, message: "Use the Enrolment Drives reporting batch workflow to create or update activities" });
    try {
      const scope = require("../utils/enrolmentDriveWorkflow").scopeWhere(req.user);
      if (scope.state_code) { req.query.state_code = scope.state_code; req.query.state_id = scope.state_code; }
      if (scope.zonal_code) { req.query.zonal_code = scope.zonal_code; req.query.zone_id = scope.zonal_code; }
      next();
    } catch (error) { next(error); }
  });
  router.param("id", async (req, res, next, id) => {
    try {
      const record = await require("../models").EnrolmentDriveReport.findByPk(id);
      if (!record) return res.status(404).json({ success: false, message: "Activity not found" });
      require("../utils/enrolmentDriveWorkflow").assertScope(req.user, record);
      next();
    } catch (error) { next(error); }
  });
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
