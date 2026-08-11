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
router.get("/dashboard/drill", ctrl.dashboardDrill);
router.get("/facilities", ctrl.listFacilities);
router.get("/accredited-providers", require("../controllers/nhiaAccreditation.controller").listProviders);

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
router.get("/complaints/:id", ctrl.getComplaint);
router.post("/complaints", authorize(...submitters), [
  body("date_received").optional(),
  body("complaint_date").optional(),
], validate, ctrl.createComplaint);
router.put("/complaints/:id", authorize(...submitters), ctrl.updateComplaint);

router.get("/satisfaction-surveys", ctrl.listSatisfactionSurveys);
router.get("/satisfaction-surveys/:id", ctrl.getSatisfactionSurvey);
router.post("/satisfaction-surveys", authorize(...submitters), [
  body("provider_name").notEmpty(),
  body("survey_date").notEmpty(),
  body("responses").isArray(),
], validate, ctrl.createSatisfactionSurvey);
router.put("/satisfaction-surveys/:id", authorize(...submitters), ctrl.updateSatisfactionSurvey);

router.get("/comment-cards", ctrl.listCommentCards);
router.get("/comment-cards/:id", ctrl.getCommentCard);
router.post("/comment-cards", authorize(...submitters), [
  body("card_date").notEmpty(),
  body("responses").isArray(),
], validate, ctrl.createCommentCard);
router.put("/comment-cards/:id", authorize(...submitters), ctrl.updateCommentCard);

module.exports = router;
