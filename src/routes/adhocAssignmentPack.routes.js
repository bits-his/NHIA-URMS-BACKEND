const express = require("express");
const { authenticate } = require("../middleware/auth");
const { upload } = require("../middleware/adhocUpload");
const ctrl = require("../controllers/adhocAssignmentPack.controller");

const router = express.Router();
router.use(authenticate);

/** Guard middleware: Restrict assignment registration, dispatch, and closure to SDO / Admin only */
function requireSdoStaff(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  const role = String(user.role || "").toLowerCase();
  const isSdo =
    role === "admin" ||
    role === "super-admin" ||
    role === "sdo" ||
    role.startsWith("sdo-") ||
    user.department_code === "SDU" ||
    user.department_code === "SDO" ||
    user.department_code === "SPD";

  if (!isSdo) {
    return res.status(403).json({
      success: false,
      message: "Access denied: Only authorized SDO or Administrator staff can create, dispatch, or close assignments.",
    });
  }
  next();
}

// Dropdown lookups
router.get("/lookups/departments", ctrl.listDepartments);
router.get("/lookups/states", ctrl.listStatesWithZones);

// SDO Master Register Endpoints (Form 1 & Form 2)
router.get("/master", ctrl.listMasterAssignments);
router.post("/master", requireSdoStaff, upload.single("original_instruction_file"), ctrl.createMasterAssignment);
router.get("/master/:id", ctrl.getMasterAssignment);
router.put("/master/:id", requireSdoStaff, upload.single("original_instruction_file"), ctrl.updateMasterAssignment);
router.post("/master/:id/dispatch", requireSdoStaff, ctrl.dispatchToStates);

// State Assigned Tasks Endpoints
router.get("/state-assignments", ctrl.listStateAssignments);
router.get("/state-assignments/:stateAssignmentId", ctrl.getStateAssignment);
router.post(
  "/state-assignments/:stateAssignmentId/report",
  upload.array("evidence_files", 10),
  ctrl.submitStateReport
);
router.patch("/state-assignments/:stateAssignmentId/close", requireSdoStaff, ctrl.closeStateAssignment);

// Review & Clarifications
router.post("/reports/:reportId/review", ctrl.reviewStateReport);

// Legacy/Compatibility paths for stateOfficeReportsList or standard GET /reports
router.get("/reports", ctrl.listStateAssignments);
router.get("/reports/:stateAssignmentId", ctrl.getStateAssignment);
router.post("/reports", requireSdoStaff, upload.single("original_instruction_file"), ctrl.createMasterAssignment);

module.exports = router;
