const express = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/weeklyCompliancePack.controller");

const router = express.Router();
router.use(authenticate);
router.get("/", ctrl.listReports);
router.get("/:id", ctrl.getReport);
router.post("/", ctrl.createReport);
router.put("/:id", ctrl.updateReport);

module.exports = router;
