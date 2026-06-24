const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const { upload } = require("../middleware/servicomUpload");
const ctrl = require("../controllers/servicom.controller");
const { SUBMITTERS, REVIEWERS } = require("../utils/servicomScope");

const router = Router();
router.use(authenticate);

const visitRules = [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("facility_name").notEmpty(),
  body("visit_date").notEmpty(),
  body("monitoring_type").optional(),
];

const reviewers = [...REVIEWERS];
const submitters = [...SUBMITTERS];

router.get("/indicators", ctrl.listIndicators);
router.get("/dashboard", ctrl.dashboard);
router.get("/facilities", ctrl.listFacilities);

router.get("/visits", ctrl.listVisits);
router.get("/visits/:id", ctrl.getVisit);
router.post("/visits", authorize(...submitters), visitRules, validate, ctrl.createVisit);
router.put("/visits/:id", authorize(...submitters), ctrl.updateVisit);
router.patch("/visits/:id/submit", authorize(...submitters), ctrl.submitVisit);
router.patch("/visits/:id/review", authorize(...reviewers), body("note").optional(), validate, ctrl.reviewVisit);
router.patch("/visits/:id/approve", authorize(...reviewers), ctrl.approveVisit);
router.patch("/visits/:id/return", authorize(...reviewers), body("reason").notEmpty(), validate, ctrl.returnVisit);
router.post("/visits/:id/evidence", authorize(...submitters), upload.single("file"), ctrl.uploadEvidence);

router.get("/complaints", ctrl.listComplaints);
router.post("/complaints", authorize(...submitters), [
  body("facility_name").notEmpty(),
  body("complaint_date").notEmpty(),
  body("description").notEmpty(),
  body("category").notEmpty(),
], validate, ctrl.createComplaint);
router.put("/complaints/:id", authorize(...submitters), ctrl.updateComplaint);

module.exports = router;
