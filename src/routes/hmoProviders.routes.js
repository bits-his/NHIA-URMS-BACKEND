const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/hmoProvider.controller");

const router = Router();
router.use(authenticate);

router.get("/", ctrl.listProviders);
router.get("/:id", ctrl.getProvider);

module.exports = router;
