const express = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/meetingsCoordination.controller");
const { upload } = require("../middleware/meetingsUpload");

const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (!ctrl.hasAccess(req.user)) return res.status(403).json({ success: false, message: "Meetings & Coordination access is required" });
  next();
});

router.get("/catalogue", ctrl.catalogue);
router.get("/meetings/open-action-points", ctrl.openActionPoints);
router.get("/meetings", ctrl.listMeetings);
router.post("/meetings", ctrl.createMeeting);
router.get("/meetings/:id", ctrl.getMeeting);
router.put("/meetings/:id", ctrl.updateMeeting);
router.post("/meetings/:id/transition", ctrl.transitionMeeting);
router.post("/meetings/:id/documents", upload.array("files", 10), ctrl.uploadMeetingDocuments);
router.delete("/meetings/:id/documents/:sn", ctrl.deleteMeetingDocument);
router.get("/etmc", ctrl.listEtmc);
router.post("/etmc", ctrl.createEtmc);
router.get("/etmc/:id", ctrl.getEtmc);
router.put("/etmc/:id", ctrl.updateEtmc);
router.post("/etmc/:id/transition", ctrl.transitionEtmc);

module.exports = router;
