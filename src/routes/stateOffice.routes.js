const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { enrolment, migration, cemonc } = require("../controllers/stateOfficeReport.controller");

const router = Router();

const headerRules = [
  body("zone_id").notEmpty().withMessage("Zone is required"),
  body("state_id").notEmpty().withMessage("State is required"),
  body("reporting_year").isInt({ min: 2000 }).withMessage("Valid year is required"),
  body("reporting_month").isInt({ min: 1, max: 12 }).withMessage("Valid month is required"),
];

const mount = (path, ctrl) => {
  router.get(`/${path}/reports`,           ctrl.listReports);
  router.get(`/${path}/reports/:id`,       ctrl.getReport);
  router.post(`/${path}/reports`,         headerRules, validate, ctrl.createReport);
  router.put(`/${path}/reports/:id`,      headerRules, validate, ctrl.updateReport);
  router.patch(`/${path}/reports/:id/status`,
    body("status").notEmpty(), validate, ctrl.updateStatus
  );
};

mount("enrolment", enrolment);
mount("migration", migration);
mount("cemonc", cemonc);

module.exports = router;
