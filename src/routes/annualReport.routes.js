const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const {
  createReport,
  listReports,
  getReport,
  updateReport,
  approveReport,
  rejectReport,
  updateStatus,
  deleteReport,
} = require("../controllers/annualReport.controller");
const { getOperationalDataHandler } = require("../controllers/operationalData.controller");

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Validation rules ─────────────────────────────────────────────────────────

const reportRules = [
  body("general.year")
    .notEmpty().withMessage("Reporting year is required")
    .isInt({ min: 2000, max: 2100 }).withMessage("Invalid year"),
  body("general.state")
    .notEmpty().withMessage("State is required")
    .isString().trim(),
  body("general.approvedBudget2025")
    .optional({ nullable: true, checkFalsy: true })
    .isDecimal().withMessage("Approved budget must be a number"),
  body("general.totalAmountUtilized2025")
    .optional({ nullable: true, checkFalsy: true })
    .isDecimal().withMessage("Total amount utilized must be a number"),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// List — role-scoped in controller
router.get("/", listReports);

// Operational data aggregated from monthly reports (Excel format)
router.get("/operational-data", getOperationalDataHandler);

// Single report
router.get("/:referenceId", getReport);

// Create — state officers and state coordinators can submit
router.post("/",
  authorize("state-officer", "state-coordinator", "admin"),
  reportRules, validate,
  createReport
);

// Update — only on draft/rejected reports
router.put("/:referenceId",
  authorize("state-officer", "state-coordinator", "admin"),
  reportRules, validate,
  updateReport
);

// ── Approval chain ────────────────────────────────────────────────────────────

// Approve: state-coordinator → under_review, zonal-coordinator → zonal_review, sdo → approved
router.patch("/:referenceId/approve",
  authorize("state-coordinator", "zonal-coordinator", "sdo", "admin"),
  body("note").optional().isString(),
  validate,
  approveReport
);

// Reject: any reviewer can reject with a reason
router.patch("/:referenceId/reject",
  authorize("state-coordinator", "zonal-coordinator", "sdo", "admin"),
  body("reason").notEmpty().withMessage("Rejection reason is required"),
  validate,
  rejectReport
);

// Generic status override — admin only
router.patch("/:referenceId/status",
  authorize("admin"),
  body("status").notEmpty().withMessage("Status is required"),
  validate,
  updateStatus
);

// Delete — admin only
router.delete("/:referenceId", authorize("admin"), deleteReport);

module.exports = router;
