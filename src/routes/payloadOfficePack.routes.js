const express = require("express");
const { body } = require("express-validator");
const { authenticate, blockCoordinatorWrites } = require("../middleware/auth");
const { requireStateOfficeRoute } = require("../middleware/stateOfficeAccess");
const { validate } = require("../middleware/validate");
const { makePayloadPack } = require("../controllers/payloadOfficePack.controller");
const {
  IctSupportRegisterReport,
  ConflictInfractionReport,
  EnrolleeFeedbackReport,
} = require("../models");

function buildRouter(ctrl) {
  const router = express.Router();
  router.use(authenticate);
  router.use(requireStateOfficeRoute);
  router.use(blockCoordinatorWrites);

  const rules = [
    body("zone_id").optional(),
    body("state_id").optional(),
    body("zonal_code").optional(),
    body("state_code").optional(),
    body("reporting_year").isInt({ min: 2000 }).withMessage("Valid year is required"),
    body("reporting_month").isInt({ min: 1, max: 12 }).withMessage("Valid month is required"),
  ];

  router.get("/reports", ctrl.listReports);
  router.get("/reports/:id", ctrl.getReport);
  router.post("/reports", rules, validate, ctrl.createReport);
  router.put("/reports/:id", rules, validate, ctrl.updateReport);
  router.patch("/reports/:id/status", ctrl.updateStatus);
  return router;
}

function mountPayloadOfficePacks(app) {
  const packs = [
    ["ict-support-register", IctSupportRegisterReport, "ICT"],
    ["conflict-infraction", ConflictInfractionReport, "CIF"],
    ["enrollee-feedback", EnrolleeFeedbackReport, "EFS"],
  ];
  for (const [segment, Model, prefix] of packs) {
    if (!Model) continue;
    const ctrl = makePayloadPack({ Model, reportType: segment, refPrefix: prefix });
    app.use(`/api/state-office/${segment}`, buildRouter(ctrl));
  }
}

module.exports = { mountPayloadOfficePacks };
