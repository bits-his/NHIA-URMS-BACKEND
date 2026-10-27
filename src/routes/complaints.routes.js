const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const {
  authenticate,
  requireCreateAccess,
  requireComplaintUpdateAccess,
  blockCoordinatorWrites,
} = require("../middleware/auth");
const ctrl = require("../controllers/complaints.controller");

const router = Router();
router.use(authenticate);

router.get("/", ctrl.listComplaints);
router.get("/next-number", ctrl.previewNextNumber);
router.get("/sla", ctrl.listComplaintSla);
router.get("/:id/comments", ctrl.listComplaintComments);
router.post(
  "/:id/comments",
  requireComplaintUpdateAccess,
  [body("body").notEmpty().withMessage("Comment is required")],
  validate,
  ctrl.addComplaintComment,
);
router.get("/:id", ctrl.getComplaint);
router.post(
  "/",
  requireCreateAccess,
  blockCoordinatorWrites,
  [
    body("date_received").optional(),
    body("complaint_date").optional(),
    body().custom((_, { req }) => {
      if (!req.body.state_code && !req.body.state_id) {
        throw new Error("state_code is required");
      }
      return true;
    }),
  ],
  validate,
  ctrl.createComplaint,
);
router.put("/:id", requireComplaintUpdateAccess, ctrl.updateComplaint);

module.exports = router;
