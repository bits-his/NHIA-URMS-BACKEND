const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload } = require("../middleware/adhocUpload");
const ctrl = require("../controllers/adhocAssignmentPack.controller");

const router = express.Router();
router.use(authenticate);

// Dropdown lookups
router.get("/lookups/departments", ctrl.listDepartments);
router.get("/lookups/states", ctrl.listStatesWithZones);

// SDO Master Register Endpoints (Form 1 & Form 2)
router.get("/master", ctrl.listMasterAssignments);
router.post("/master", upload.single("original_instruction_file"), ctrl.createMasterAssignment);
router.get("/master/:id", ctrl.getMasterAssignment);
router.put("/master/:id", upload.single("original_instruction_file"), ctrl.updateMasterAssignment);
router.post("/master/:id/dispatch", ctrl.dispatchToStates);

// State Assigned Tasks Endpoints
router.get("/state-assignments", ctrl.listStateAssignments);
router.get("/state-assignments/:stateAssignmentId", ctrl.getStateAssignment);
router.post(
  "/state-assignments/:stateAssignmentId/report",
  upload.array("evidence_files", 10),
  ctrl.submitStateReport
);
router.patch("/state-assignments/:stateAssignmentId/close", ctrl.closeStateAssignment);

// Review & Clarifications
router.post("/reports/:reportId/review", ctrl.reviewStateReport);

// Legacy/Compatibility paths for stateOfficeReportsList or standard GET /reports
router.get("/reports", ctrl.listStateAssignments);
router.get("/reports/:stateAssignmentId", ctrl.getStateAssignment);
router.post("/reports", upload.single("original_instruction_file"), ctrl.createMasterAssignment);

module.exports = router;
