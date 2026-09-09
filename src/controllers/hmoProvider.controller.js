const { Op } = require("sequelize");
const { HmoProvider } = require("../models");

/**
 * GET /api/hmo-providers
 * Query: q, limit
 */
const listProviders = async (req, res, next) => {
  try {
    const where = { is_active: true };
    if (req.query.q) {
      const q = String(req.query.q).trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { hmo_code: { [Op.like]: `%${q}%` } },
        { hmo_code_raw: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
    const rows = await HmoProvider.findAll({
      where,
      order: [["name", "ASC"]],
      limit,
    });
    res.json({ success: true, data: rows, meta: { count: rows.length } });
  } catch (err) { next(err); }
};

const getProvider = async (req, res, next) => {
  try {
    const row = await HmoProvider.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "HMO not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

module.exports = { listProviders, getProvider };
