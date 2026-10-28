const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload: beneficiaryUpload } = require("../middleware/beneficiaryUpload");
const ctrl = require("../controllers/providerPack.controller");

function buildRouter(formTypeOrSegment = null) {
  const router = express.Router();
  router.use(authenticate);
  if (formTypeOrSegment) {
    router.use(ctrl.lockFormType(formTypeOrSegment));
  }
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

function mountProviderPack(app) {
  const dash = require("../controllers/providerManagementDashboard.controller");
  const { requireStateOfficeSection } = require("../middleware/stateOfficeAccess");

  // Dashboard must mount before the accreditation pack router (same path prefix)
  app.get(
    "/api/state-office/accreditation/dashboard",
    authenticate,
    requireStateOfficeSection("Provider Management Dashboard"),
    dash.dashboard,
  );
  app.get(
    "/api/state-office/provider-management/dashboard",
    authenticate,
    requireStateOfficeSection("Provider Management Dashboard"),
    dash.dashboard,
  );

  // Canonical pack
  app.use("/api/state-office/provider-management", buildRouter(null));
  // Form-type aliases (existing FE segments)
  app.use("/api/state-office/provider-accreditation", buildRouter("accreditation"));
  app.use("/api/state-office/provider-reaccreditation", buildRouter("reaccreditation"));
  app.use("/api/state-office/provider-qa-inspections", buildRouter("qa-inspections"));
  app.use("/api/state-office/provider-medical-audits", buildRouter("medical-audits"));
  // Legacy accreditation segment → accreditation form_type
  app.use("/api/state-office/accreditation", buildRouter("accreditation"));
}

module.exports = { mountProviderPack, buildRouter };
