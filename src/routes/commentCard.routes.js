const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const {
  authenticate,
  requireCreateAccess,
  blockCoordinatorWrites,
} = require("../middleware/auth");
const ctrl = require("../controllers/commentCard.controller");

const router = Router();
router.use(authenticate);

router.get("/", ctrl.listCommentCards);
router.get("/:id", ctrl.getCommentCard);
router.post(
  "/",
  blockCoordinatorWrites,
  requireCreateAccess,
  [
    body("card_date").notEmpty().withMessage("Date is required"),
    body("state_code")
      .optional()
      .isString(),
    body("state_id").optional(),
    body().custom((_, { req }) => {
      if (!req.body.state_code && !req.body.state_id) {
        throw new Error("state_code is required");
      }
      return true;
    }),
    body("responses").isArray().withMessage("Responses are required"),
  ],
  validate,
  ctrl.createCommentCard,
);
router.put("/:id", blockCoordinatorWrites, requireCreateAccess, ctrl.updateCommentCard);

module.exports = router;
