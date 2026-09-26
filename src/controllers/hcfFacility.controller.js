const { Op } = require("sequelize");
const { HcfFacility, ZonalOffice, StateOffice } = require("../models");
const { resolveNhiaPrefix } = require("../utils/nhiaStateFilter");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] },
  { model: StateOffice, as: "state", attributes: ["id", "description", "code"] },
];

const BAD_CODE = /^(yes|no|nil|n\/a|na|none|0+|not issued|newly registered|accreditation|non\b.*)$/i;

function looksLikeNhiaCode(code) {
  if (!code) return false;
  const s = String(code).replace(/\s+/g, "").trim();
  if (!s || BAD_CODE.test(s) || s.length < 4) return false;
  return /[A-Za-z]{1,4}[\/\-]?\d{2,}/.test(s);
}

/** KN/0082/S7, KN/0082/P, KN/0074/S/8, KN0379 → KN/0082 hospital-level code */
function hospitalCodeBase(code) {
  if (!looksLikeNhiaCode(code)) return null;
  let s = String(code).replace(/\s+/g, "").toUpperCase();
  s = s.replace(/\/P$/i, "");
  s = s.replace(/\/S\/?\d+$/i, "");
  const m = s.match(/^([A-Z]{1,4})[/\-]?(\d{2,5})/);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

function normHospitalName(name) {
  return String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isPrimaryService(svc) {
  return /^primary\s+provider$/i.test(String(svc || "").trim());
}

function hospitalRowScore(r) {
  let score = 0;
  if (isPrimaryService(r.service_applied_for)) score += 100;
  const acc = String(r.accreditation_code || "");
  if (looksLikeNhiaCode(acc) && !/\/S/i.test(acc)) score += 20;
  if (hospitalCodeBase(r.facility_code)) score += 10;
  if (looksLikeNhiaCode(acc)) score += 5;
  if (r.address) score += 1;
  return score;
}

function pickBetterHospital(prev, next) {
  if (!prev) return next;
  return hospitalRowScore(next) > hospitalRowScore(prev) ? next : prev;
}

/** One row per hospital — collapse department/service lines that share a code or name. */
function uniqueHospitals(rows) {
  const byCode = new Map();
  const unnamed = [];
  for (const r of rows) {
    const code = hospitalCodeBase(r.facility_code) || hospitalCodeBase(r.accreditation_code);
    const statePart = String(r.state_id || r.state_name || "").toLowerCase();
    if (code) {
      const key = `${code}|${statePart}`;
      byCode.set(key, pickBetterHospital(byCode.get(key), r));
    } else {
      unnamed.push(r);
    }
  }

  const namesTaken = new Set();
  for (const r of byCode.values()) {
    namesTaken.add(`${normHospitalName(r.name)}|${String(r.state_id || r.state_name || "").toLowerCase()}`);
  }

  const byName = new Map();
  for (const r of unnamed) {
    const nameKey = `${normHospitalName(r.name)}|${String(r.state_id || r.state_name || "").toLowerCase()}`;
    if (!nameKey.startsWith("|") && namesTaken.has(nameKey)) continue;
    byName.set(nameKey, pickBetterHospital(byName.get(nameKey), r));
  }

  const merged = [...byCode.values(), ...byName.values()];
  const byHospitalName = new Map();
  for (const r of merged) {
    const nameKey = `${normHospitalName(r.name)}|${String(r.state_id || r.state_name || "").toLowerCase()}`;
    byHospitalName.set(nameKey, pickBetterHospital(byHospitalName.get(nameKey), r));
  }

  return [...byHospitalName.values()].map((r) => {
    const hospital_code = hospitalCodeBase(r.facility_code) || hospitalCodeBase(r.accreditation_code)
      || r.facility_code || (looksLikeNhiaCode(r.accreditation_code) ? r.accreditation_code : null);
    return {
      ...r,
      hospital_code: hospital_code || null,
      accreditation_code: hospital_code || r.accreditation_code,
      service_applied_for: null,
    };
  }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
}

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
 * Query: q, state_id, service, unique=1 (one row per hospital, not per service/department), limit
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
      limit: unique ? 15000 : limit,
    });

    let data = rows.map((r) => r.toJSON());
    if (unique) {
      data = uniqueHospitals(data).slice(0, limit);
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
