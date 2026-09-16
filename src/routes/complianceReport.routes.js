const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/complianceReport.controller");
const { optionalCertUpload } = require("../middleware/complianceCertUpload");

const router = Router();
router.use(authenticate);

const createRules = [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("facility_name").notEmpty().withMessage("Facility name is required"),
];

router.get("/", ctrl.listReports);
router.get("/:id", ctrl.getReport);
router.post("/", optionalCertUpload, createRules, validate, ctrl.createReport);
router.put("/:id", optionalCertUpload, ctrl.updateReport);
router.patch("/:id/status", body("status").notEmpty(), validate, ctrl.updateStatus);

module.exports = router;
