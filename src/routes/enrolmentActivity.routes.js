const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, blockCoordinatorWrites } = require("../middleware/auth");
const { requireStateOfficeSection } = require("../middleware/stateOfficeAccess");
const ctrl = require("../controllers/enrolmentActivity.controller");

const router = Router();

router.use(authenticate);
router.use(requireStateOfficeSection("Enrolment"));
router.use(blockCoordinatorWrites);

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

module.exports = router;
