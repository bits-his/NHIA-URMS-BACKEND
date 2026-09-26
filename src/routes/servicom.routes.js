const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, authorize, authorizeRoleFlag } = require("../middleware/auth");
const { upload } = require("../middleware/servicomUpload");
const ctrl = require("../controllers/servicom.controller");

const router = Router();
router.use(authenticate);

const visitRules = [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("facility_name").notEmpty(),
  body("visit_date").notEmpty(),
  body("monitoring_type").optional(),
];

const reviewers = authorizeRoleFlag("can_review_monthly");
const submitters = authorizeRoleFlag("can_create_monthly", ["sdo"]);

router.get("/indicators", ctrl.listIndicators);
router.get("/dashboard", ctrl.dashboard);
router.get("/dashboard/drill", ctrl.dashboardDrill);
router.get("/facilities", ctrl.listFacilities);
router.get("/accredited-providers", require("../controllers/nhiaAccreditation.controller").listProviders);
router.get("/hcf-facilities", require("../controllers/hcfFacility.controller").listFacilities);
router.get("/hcf-facilities/services", require("../controllers/hcfFacility.controller").listServices);

router.get("/visits", ctrl.listVisits);
router.get("/visits/:id", ctrl.getVisit);
router.post("/visits", submitters, visitRules, validate, ctrl.createVisit);
router.put("/visits/:id", submitters, ctrl.updateVisit);
router.patch("/visits/:id/submit", submitters, ctrl.submitVisit);
router.patch("/visits/:id/review", reviewers, body("note").optional(), validate, ctrl.reviewVisit);
router.patch("/visits/:id/approve", reviewers, ctrl.approveVisit);
router.patch("/visits/:id/return", reviewers, body("reason").notEmpty(), validate, ctrl.returnVisit);
router.post("/visits/:id/evidence", submitters, upload.single("file"), ctrl.uploadEvidence);

router.get("/investigating-officers", ctrl.listInvestigatingOfficers);
router.get("/complaints", ctrl.listComplaints);
router.get("/complaints/next-number", ctrl.previewComplaintNumber);
router.get("/complaint-sla", ctrl.listComplaintSla);
router.get("/complaints/:id", ctrl.getComplaint);
router.post("/complaints", submitters, [
  body("date_received").optional(),
  body("complaint_date").optional(),
], validate, ctrl.createComplaint);
router.put("/complaints/:id", submitters, ctrl.updateComplaint);
router.get("/complaints/:id/comments", ctrl.listComplaintComments);
router.post("/complaints/:id/comments", [
  body("body").notEmpty().withMessage("Comment is required"),
], validate, ctrl.addComplaintComment);

router.get("/satisfaction-surveys", ctrl.listSatisfactionSurveys);
router.get("/satisfaction-surveys/:id", ctrl.getSatisfactionSurvey);
router.post("/satisfaction-surveys", submitters, [
  body("provider_name").notEmpty(),
  body("survey_date").notEmpty(),
  body("responses").isArray(),
], validate, ctrl.createSatisfactionSurvey);
router.put("/satisfaction-surveys/:id", submitters, ctrl.updateSatisfactionSurvey);

router.get("/comment-cards", ctrl.listCommentCards);
router.get("/comment-cards/:id", ctrl.getCommentCard);
router.post("/comment-cards", submitters, [
  body("card_date").notEmpty().withMessage("Date is required"),
  body("state_id").notEmpty().withMessage("State is required"),
  body("responses").isArray().withMessage("Responses are required"),
], validate, ctrl.createCommentCard);
router.put("/comment-cards/:id", submitters, ctrl.updateCommentCard);

module.exports = router;
