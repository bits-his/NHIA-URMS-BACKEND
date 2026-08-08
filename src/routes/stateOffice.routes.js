const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireStateOfficeRoute } = require("../middleware/stateOfficeAccess");
const {
  enrolment, migration, cemonc,
  accreditation, stakeholder, hmoSelection, challenges, complaints,  igr, sshiaFinancial, expenditureProfile
} = require("../controllers/stateOfficeReport.controller");
const enrolleeComplaints = require("../controllers/stateOfficeComplaint.controller");
const complianceVisits = require("../controllers/stateOfficeComplianceVisit.controller");
const reconciliation = require("../controllers/stateOfficeReconciliation.controller");
const nhiaAccreditation = require("../controllers/nhiaAccreditation.controller");

const router = Router();

router.use(authenticate);
router.use(requireStateOfficeRoute);

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
mount("complaints", complaints);
mount("accreditation", accreditation);
mount("stakeholder", stakeholder);
mount("hmo-selection", hmoSelection);
mount("challenges", challenges);
mount("igr", igr);
mount("sshia-financial", sshiaFinancial);
mount("expenditure-profile", expenditureProfile);

router.get("/enrollee-complaints/summary", enrolleeComplaints.getSummary);
router.get("/enrollee-complaints", enrolleeComplaints.listComplaints);
router.get("/enrollee-complaints/:id", enrolleeComplaints.getComplaint);
router.post("/enrollee-complaints", [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("against_type").isIn(["against_hmo", "against_hcp"]),
  body("entity_name").notEmpty(),
  body("description").notEmpty(),
  body("complaint_date").notEmpty(),
], validate, enrolleeComplaints.createComplaint);
router.put("/enrollee-complaints/:id", enrolleeComplaints.updateComplaint);

router.get("/compliance-visits", complianceVisits.listVisits);
router.get("/compliance-visits/:id", complianceVisits.getVisit);
router.post("/compliance-visits", [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("facility_visited").notEmpty(),
], validate, complianceVisits.createVisit);
router.put("/compliance-visits/:id", complianceVisits.updateVisit);

router.get("/accredited-providers", nhiaAccreditation.listProviders);
router.post("/accredited-providers/sync", nhiaAccreditation.syncProviders);

router.get("/reconciliation-meetings", reconciliation.listMeetings);
router.post("/reconciliation-meetings", [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("hmo").notEmpty(),
  body("facility").notEmpty(),
], validate, reconciliation.createMeeting);
router.put("/reconciliation-meetings/:id", reconciliation.updateMeeting);

module.exports = router;
