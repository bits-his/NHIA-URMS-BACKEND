const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/monthlyReport.controller");

const router = Router();

// All routes require authentication
router.use(authenticate);

const baseRules = [
  body("state_id").notEmpty().withMessage("state_id is required"),
  body("reporting_year").isInt({ min: 2000, max: 2100 }).withMessage("Invalid year"),
  body("reporting_month").isInt({ min: 1, max: 12 }).withMessage("Month must be 1-12"),
];

const reviewers = ["state-coordinator", "zonal-coordinator", "sdo", "admin"];
const submitters = ["state-officer", "state-coordinator", "department-officer", "admin"];

// ── Finance ───────────────────────────────────────────────────────────────────
router.get("/finance",                ctrl.finance.list);
router.get("/finance/aggregate",      ctrl.finance.aggregate);
router.get("/finance/:id",            ctrl.finance.get);
router.post("/finance",               authorize(...submitters), baseRules, validate, ctrl.finance.create);
router.put("/finance/:id",            authorize(...submitters), ctrl.finance.update);
router.patch("/finance/:id/approve",  authorize(...reviewers), body("note").optional(), validate, ctrl.finance.approve);
router.patch("/finance/:id/reject",   authorize(...reviewers), body("reason").notEmpty(), validate, ctrl.finance.reject);
router.patch("/finance/:id/status",   authorize("admin"), body("status").notEmpty(), validate, ctrl.finance.updateStatus);

// ── Programmes ────────────────────────────────────────────────────────────────
router.get("/programmes",                ctrl.programmes.list);
router.get("/programmes/aggregate",      ctrl.programmes.aggregate);
router.get("/programmes/:id",            ctrl.programmes.get);
router.post("/programmes",               authorize(...submitters), baseRules, validate, ctrl.programmes.create);
router.put("/programmes/:id",            authorize(...submitters), ctrl.programmes.update);
router.patch("/programmes/:id/approve",  authorize(...reviewers), body("note").optional(), validate, ctrl.programmes.approve);
router.patch("/programmes/:id/reject",   authorize(...reviewers), body("reason").notEmpty(), validate, ctrl.programmes.reject);
router.patch("/programmes/:id/status",   authorize("admin"), body("status").notEmpty(), validate, ctrl.programmes.updateStatus);

// ── SQA ───────────────────────────────────────────────────────────────────────
router.get("/sqa",                ctrl.sqa.list);
router.get("/sqa/aggregate",      ctrl.sqa.aggregate);
router.get("/sqa/:id",            ctrl.sqa.get);
router.post("/sqa",               authorize(...submitters), baseRules, validate, ctrl.sqa.create);
router.put("/sqa/:id",            authorize(...submitters), ctrl.sqa.update);
router.patch("/sqa/:id/approve",  authorize(...reviewers), body("note").optional(), validate, ctrl.sqa.approve);
router.patch("/sqa/:id/reject",   authorize(...reviewers), body("reason").notEmpty(), validate, ctrl.sqa.reject);
router.patch("/sqa/:id/status",   authorize("admin"), body("status").notEmpty(), validate, ctrl.sqa.updateStatus);

module.exports = router;
