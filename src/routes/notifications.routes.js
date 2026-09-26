const express = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/notifications.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", ctrl.listMine);
router.put("/read-all", ctrl.markAllRead);
router.put("/:id/read", ctrl.markRead);

module.exports = router;
