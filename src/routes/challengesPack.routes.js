const express = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/challengesSupport.controller");

const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (!ctrl.hasChallengesAccess(req.user)) return res.status(403).json({ success: false, message: "Challenges & Support access is required" });
  next();
});

router.get("/catalogue", ctrl.catalogue);
router.get("/records", ctrl.listChallenges);
router.post("/records", ctrl.createChallenge);
router.get("/records/:id", ctrl.getChallenge);
router.put("/records/:id", ctrl.updateChallenge);
router.post("/records/:id/activity", ctrl.addChallengeActivity);
router.get("/support-requests", ctrl.listSupport);
router.post("/support-requests", ctrl.createSupport);
router.get("/support-requests/:id", ctrl.getSupport);
router.post("/support-requests/:id/activity", ctrl.addSupportActivity);

module.exports = router;
