const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/hcfFacility.controller");

/** National HCF master list — any authenticated user may search */
const router = Router();
router.use(authenticate);

router.get("/", ctrl.listFacilities);
router.get("/services", ctrl.listServices);
router.get("/:id", ctrl.getFacility);

module.exports = router;
