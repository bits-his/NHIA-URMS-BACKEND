const express = require("express");
const { authenticate, blockCoordinatorWrites } = require("../middleware/auth");
const { requireStateOfficeRoute } = require("../middleware/stateOfficeAccess");
const officeProfiles = require("../controllers/stateZonalOfficeProfile.controller");
const focalPersons = require("../controllers/stateZonalFocalPerson.controller");
const officeAccommodations = require("../controllers/officeAccommodation.controller");
const utilityServices = require("../controllers/utilityServiceReport.controller");
const { optionalAopUpload } = require("../middleware/officeProfileUpload");
const { utilityFilesUpload } = require("../middleware/utilityUpload");

function mountOfficeProfilePack(app) {
  const router = express.Router();
  router.use(authenticate);
  router.use(requireStateOfficeRoute);
  router.use(blockCoordinatorWrites);

  // Form 1: General Profile
  router.get("/office-profiles", officeProfiles.listProfiles);
  router.get("/office-profiles/:id", officeProfiles.getProfile);
  router.post("/office-profiles", optionalAopUpload, officeProfiles.createProfile);
  router.put("/office-profiles/:id", optionalAopUpload, officeProfiles.updateProfile);
  router.patch("/office-profiles/:id/status", officeProfiles.updateStatus);
  router.delete("/office-profiles/:id", officeProfiles.deleteProfile);

  // Form 2: Office Accommodation
  router.get("/office-accommodations", officeAccommodations.listAccommodations);
  router.get("/office-accommodations/:id", officeAccommodations.getAccommodation);
  router.post("/office-accommodations", officeAccommodations.createAccommodation);
  router.put("/office-accommodations/:id", officeAccommodations.updateAccommodation);
  router.delete("/office-accommodations/:id", officeAccommodations.deleteAccommodation);

  // Form 3: Utility Services
  router.get("/utility-services/reports", utilityServices.listReports);
  router.get("/utility-services/reports/:id", utilityServices.getReport);
  router.post("/utility-services/reports", utilityFilesUpload, utilityServices.createReport);
  router.put("/utility-services/reports/:id", utilityFilesUpload, utilityServices.updateReport);
  router.patch("/utility-services/reports/:id/status", utilityServices.updateStatus);
  router.post("/utility-services/consolidate", utilityServices.consolidateReports);
  router.delete("/utility-services/reports/:id", utilityServices.deleteReport);

  // Form 4: Focal Persons
  router.get("/focal-persons", focalPersons.listRecords);
  router.get("/focal-persons/:id", focalPersons.getRecord);
  router.post("/focal-persons", focalPersons.createRecord);
  router.put("/focal-persons/:id", focalPersons.updateRecord);
  router.post("/focal-persons/roster", focalPersons.saveRoster);
  router.delete("/focal-persons/:id", focalPersons.deleteRecord);

  app.use("/api/state-office", router);
}

module.exports = { mountOfficeProfilePack };

