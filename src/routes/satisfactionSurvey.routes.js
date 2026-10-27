const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const {
  authenticate,
  requireCreateAccess,
  blockCoordinatorWrites,
} = require("../middleware/auth");
const ctrl = require("../controllers/satisfactionSurvey.controller");

const router = Router();
router.use(authenticate);

router.get("/", ctrl.listSatisfactionSurveys);
router.get("/:id", ctrl.getSatisfactionSurvey);
router.post(
  "/",
  blockCoordinatorWrites,
  requireCreateAccess,
  [
    body("survey_date").notEmpty().withMessage("Survey date is required"),
    body("provider_name").notEmpty().withMessage("Provider name is required"),
    body().custom((_, { req }) => {
      if (!req.body.state_code && !req.body.state_id) {
        throw new Error("state_code is required");
      }
      return true;
    }),
    body("responses").isArray().withMessage("Responses are required"),
  ],
  validate,
  ctrl.createSatisfactionSurvey,
);
router.put("/:id", blockCoordinatorWrites, requireCreateAccess, ctrl.updateSatisfactionSurvey);

module.exports = router;
