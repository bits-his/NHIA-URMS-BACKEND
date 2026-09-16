const { Op } = require("sequelize");
const { HcfFacility, ZonalOffice, StateOffice } = require("../models");
const { resolveNhiaPrefix } = require("../utils/nhiaStateFilter");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] },
  { model: StateOffice, as: "state", attributes: ["id", "description", "code"] },
];

async function stateMatchClause(stateId) {
  if (!stateId) return null;
  const or = [{ state_id: stateId }];
  const state = await StateOffice.findByPk(stateId, { attributes: ["id", "description", "code"] });
  const desc = (state?.description || "").replace(/\(.*?\)/g, "").trim();
  if (desc) {
    or.push({ state_name: { [Op.like]: `%${desc}%` } });
  }
  const resolved = await resolveNhiaPrefix(stateId);
  if (resolved?.prefix) {
    or.push({ accreditation_code: { [Op.like]: `${resolved.prefix}/%` } });
    or.push({ facility_code: { [Op.like]: `${resolved.prefix}/%` } });
  }
  return { [Op.or]: or };
}

/**
 * GET /api/hcf-facilities
 * Query: q, state_id, service, unique=1 (dedupe by accreditation_code/name), limit
 */
const listFacilities = async (req, res, next) => {
  try {
    const and = [{ is_active: true }];
    const stateClause = await stateMatchClause(req.query.state_id);
    if (stateClause) and.push(stateClause);
    if (req.query.service) {
      and.push({ service_applied_for: { [Op.like]: `%${String(req.query.service).trim()}%` } });
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      and.push({
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { accreditation_code: { [Op.like]: `%${q}%` } },
          { facility_code: { [Op.like]: `%${q}%` } },
          { lga: { [Op.like]: `%${q}%` } },
          { state_name: { [Op.like]: `%${q}%` } },
        ],
      });
    }

    const where = and.length === 1 ? and[0] : { [Op.and]: and };
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const unique = String(req.query.unique || "") === "1" || String(req.query.unique || "") === "true";

    const rows = await HcfFacility.findAll({
      where,
      include: includeGeo,
      order: [["name", "ASC"], ["service_applied_for", "ASC"]],
      limit: unique ? Math.min(limit * 5, 5000) : limit,
    });

    let data = rows.map((r) => r.toJSON());
    if (unique) {
      const seen = new Set();
      data = data.filter((r) => {
        const key = (r.accreditation_code && !/^(yes|nil|0000)$/i.test(r.accreditation_code)
          ? r.accreditation_code
          : `${r.name}|${r.state_name || ""}`
        ).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);
    }

    res.json({ success: true, data, meta: { count: data.length } });
  } catch (err) { next(err); }
};

const listServices = async (req, res, next) => {
  try {
    const rows = await HcfFacility.findAll({
      attributes: ["service_applied_for"],
      where: { is_active: true, service_applied_for: { [Op.ne]: null } },
      group: ["service_applied_for"],
      order: [["service_applied_for", "ASC"]],
      raw: true,
    });
    res.json({
      success: true,
      data: rows.map((r) => r.service_applied_for).filter(Boolean),
    });
  } catch (err) { next(err); }
};

const getFacility = async (req, res, next) => {
  try {
    const row = await HcfFacility.findByPk(req.params.id, { include: includeGeo });
    if (!row) return res.status(404).json({ success: false, message: "HCF facility not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

module.exports = { listFacilities, listServices, getFacility };
