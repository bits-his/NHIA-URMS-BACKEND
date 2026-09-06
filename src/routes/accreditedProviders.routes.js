const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const nhiaAccreditation = require("../controllers/nhiaAccreditation.controller");

/** NHIA reference data — any authenticated user may search providers */
const router = Router();
router.use(authenticate);

router.get("/", nhiaAccreditation.listProviders);

module.exports = router;
