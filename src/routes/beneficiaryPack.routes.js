/**
 * Mounts Beneficiary Management under legacy FE segments:
 *   /api/state-office/extra-dependant
 *   /api/state-office/hcf-change
 *   /api/state-office/hmo-selection
 */
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload: beneficiaryUpload } = require("../middleware/beneficiaryUpload");
const {
  controllersBySegment,
  BENEFICIARY_SEGMENTS,
} = require("../controllers/beneficiaryPack.controller");

function buildRouter(ctrl) {
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
  router.post(
    "/reports/:id/lines/:lineId/file",
    beneficiaryUpload.single("file"),
    ctrl.uploadLineFiles,
  );
  return router;
}

function mountBeneficiaryPack(app) {
  for (const segment of BENEFICIARY_SEGMENTS) {
    const ctrl = controllersBySegment[segment];
    if (!ctrl) continue;
    app.use(`/api/state-office/${segment}`, buildRouter(ctrl));
  }
}

module.exports = { mountBeneficiaryPack, buildRouter };
