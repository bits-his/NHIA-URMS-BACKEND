const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/enrolmentPack.controller");

router.use(authenticate);

router.get("/reports", ctrl.listReports);
router.get("/reports/:id", ctrl.getReport);
router.post("/reports", ctrl.createReport);
router.put("/reports/:id", ctrl.updateReport);
router.patch("/reports/:id/status", ctrl.updateStatus);

module.exports = router;
