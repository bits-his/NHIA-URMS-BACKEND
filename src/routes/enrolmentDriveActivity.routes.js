const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, blockCoordinatorWrites } = require("../middleware/auth");
const { requireStateOfficeSection } = require("../middleware/stateOfficeAccess");
const { upload: beneficiaryUpload } = require("../middleware/beneficiaryUpload");
const {
  makeEnrolmentDriveController,
  ENROLMENT_DRIVE_TYPES,
} = require("../controllers/enrolmentDriveActivity.controller");

const headerRules = [
  body("zone_id").optional(),
  body("state_id").optional(),
  body("zonal_code").optional(),
  body("state_code").optional(),
  body().custom((_, { req }) => {
    if (!req.body.zone_id && !req.body.zonal_code) {
      throw new Error("Zone is required");
    }
    if (!req.body.state_id && !req.body.state_code) {
      throw new Error("State is required");
    }
    return true;
  }),
  body("reporting_year").isInt({ min: 2000 }).withMessage("Valid year is required"),
  body("reporting_month").isInt({ min: 1, max: 12 }).withMessage("Valid month is required"),
];

function createEnrolmentDriveRouter(driveTypeKey, privilegeTitle) {
  const ctrl = makeEnrolmentDriveController(driveTypeKey);
  const router = Router();

  router.use(authenticate);
  router.use(requireStateOfficeSection(privilegeTitle));
  router.use(blockCoordinatorWrites);

  router.get("/reports", ctrl.listReports);
  router.get("/reports/:id", ctrl.getReport);
  router.post("/reports", headerRules, validate, ctrl.createReport);
  router.put("/reports/:id", headerRules, validate, ctrl.updateReport);
  router.patch(
    "/reports/:id/status",
    body("status").notEmpty().withMessage("Status is required"),
    validate,
    ctrl.updateStatus,
  );
  router.post(
    "/reports/:id/lines/:lineId/files",
    beneficiaryUpload.array("files", 10),
    ctrl.uploadLineFiles,
  );

  return router;
}

/** Mount all 8 drive segments onto an Express app under /api/state-office */
function mountEnrolmentDriveRoutes(app) {
  for (const t of ENROLMENT_DRIVE_TYPES) {
    app.use(
      `/api/state-office/${t.segment}`,
      createEnrolmentDriveRouter(t.key, t.title),
    );
  }
}

module.exports = {
  createEnrolmentDriveRouter,
  mountEnrolmentDriveRoutes,
  ENROLMENT_DRIVE_TYPES,
};
