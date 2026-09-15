const { Router } = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireStateOfficeRoute } = require("../middleware/stateOfficeAccess");
const {
  enrolment, migration, cemonc,
  accreditation, stakeholder, hmoSelection, challenges, complaints,  igr, sshiaFinancial, expenditureProfile,
  weeklyActionable, contractedServices, ictSupport, adhocAssignment,
  enrolleeRegister, etmcTmcActionPoint,
  extraDependant, hcpChange,
} = require("../controllers/stateOfficeReport.controller");
const enrolleeComplaints = require("../controllers/stateOfficeComplaint.controller");
const complianceVisits = require("../controllers/stateOfficeComplianceVisit.controller");
const reconciliation = require("../controllers/stateOfficeReconciliation.controller");
const nhiaAccreditation = require("../controllers/nhiaAccreditation.controller");
const stateOfficeDashboard = require("../controllers/stateOfficeDashboard.controller");
const adminHr = require("../controllers/adminHrReport.controller");
const officeProfiles = require("../controllers/stateZonalOfficeProfile.controller");
const focalPersons = require("../controllers/stateZonalFocalPerson.controller");
const { optionalAopUpload } = require("../middleware/officeProfileUpload");

const router = Router();

router.use(authenticate);
router.use(requireStateOfficeRoute);

router.get("/dashboard", stateOfficeDashboard.dashboard);
router.get("/dashboard/drill", stateOfficeDashboard.dashboardDrill);

const profileRules = [
  body("zone_id").notEmpty().withMessage("Zone is required"),
  body("state_id").notEmpty().withMessage("State is required"),
  body("reporting_year").isInt({ min: 2000 }).withMessage("Valid year is required"),
];

router.get("/office-profiles", officeProfiles.listProfiles);
router.get("/office-profiles/:id", officeProfiles.getProfile);
router.post("/office-profiles", optionalAopUpload, profileRules, validate, officeProfiles.createProfile);
router.put("/office-profiles/:id", optionalAopUpload, profileRules, validate, officeProfiles.updateProfile);
router.delete("/office-profiles/:id", officeProfiles.deleteProfile);

router.get("/focal-persons", focalPersons.listRecords);
router.get("/focal-persons/:id", focalPersons.getRecord);
router.post("/focal-persons", profileRules, validate, focalPersons.createRecord);
router.put("/focal-persons/:id", profileRules, validate, focalPersons.updateRecord);

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
mount("weekly-actionable", weeklyActionable);
mount("contracted-services", contractedServices);
mount("ict-support-register", ictSupport);
mount("adhoc-special-assignment", adhocAssignment);
mount("enrollee-register", enrolleeRegister);
mount("etmc-tmc-action-point", etmcTmcActionPoint);
mount("extra-dependant", extraDependant);
mount("hcf-change", hcpChange);

const { upload: etmcUpload } = require("../middleware/etmcUpload");
const { upload: beneficiaryUpload } = require("../middleware/beneficiaryUpload");
router.post(
  "/hmo-selection/reports/:id/lines/:lineId/files",
  beneficiaryUpload.single("file"),
  hmoSelection.uploadLineFile,
);
router.post(
  "/extra-dependant/reports/:id/lines/:lineId/files",
  beneficiaryUpload.array("files", 10),
  extraDependant.uploadLineFiles,
);
router.post(
  "/etmc-tmc-action-point/reports/:id/document",
  etmcUpload.single("file"),
  etmcTmcActionPoint.uploadDocument,
);

mount("office-meeting", adminHr.officeMeeting);
mount("etmc-cascading", adminHr.etmcCascading);
mount("office-accommodation", adminHr.officeAccommodation);
mount("utility-services", adminHr.utilityServices);
mount("vehicle-maintenance", adminHr.vehicleMaintenance);
mount("conflict-infraction", adminHr.conflictInfraction);
mount("enrollee-feedback", adminHr.enrolleeFeedback);

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
router.get("/hcf-facilities", require("../controllers/hcfFacility.controller").listFacilities);
router.get("/hcf-facilities/services", require("../controllers/hcfFacility.controller").listServices);

router.get("/reconciliation-meetings", reconciliation.listMeetings);
router.post("/reconciliation-meetings", [
  body("zone_id").notEmpty(),
  body("state_id").notEmpty(),
  body("hmo").notEmpty(),
  body("facility").notEmpty(),
], validate, reconciliation.createMeeting);
router.put("/reconciliation-meetings/:id", reconciliation.updateMeeting);

module.exports = router;
