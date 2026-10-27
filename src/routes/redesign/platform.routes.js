const express = require("express");
const { authenticate } = require("../../middleware/auth");
const { LookupDomain, LookupValue } = require("../../models/redesign/core");

const router = express.Router();
router.use(authenticate);

/** GET /api/platform/lookups/:domainKey — dropdown catalogs */
router.get("/lookups/:domainKey", async (req, res, next) => {
  try {
    const domain = await LookupDomain.findOne({
      where: { key_name: req.params.domainKey, is_active: true },
    });
    if (!domain) {
      return res.status(404).json({ success: false, message: "Lookup domain not found" });
    }
    const values = await LookupValue.findAll({
      where: { domain_id: domain.id, is_active: true },
      order: [["sort_order", "ASC"], ["label", "ASC"]],
      attributes: ["id", "code", "label", "parent_id", "sort_order", "meta_json"],
    });
    res.json({
      success: true,
      data: { key: domain.key_name, label: domain.label, values },
    });
  } catch (err) {
    next(err);
  }
});

/** Placeholder for forms not yet approved */
router.use((req, res) => {
  res.status(503).json({
    success: false,
    message: "This platform endpoint is disabled until the form design is approved.",
  });
});

module.exports = router;
