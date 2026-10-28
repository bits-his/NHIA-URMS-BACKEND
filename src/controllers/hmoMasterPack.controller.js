/**
 * HMO Master — read-only compile from collation + recon (Template 3).
 * Also exposes flat facts from the SQL VIEW when available.
 */
const sequelize = require("../config/database");
const {
  HmoIndebtednessReport,
  HmoIndebtednessLine,
  HmoReconReport,
  HmoReconLine,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { buildMasterGroups } = require("../utils/hmoIndebtednessCompile");

function scopeWhere(req) {
  const where = {};
  const zonal = req.query.zonal_code || req.query.zone_id;
  const state = req.query.state_code || req.query.state_id;
  if (zonal) where.zonal_code = zonal;
  if (state) where.state_code = state;
  if (req.query.year || req.query.reporting_year) {
    where.reporting_year = Number(req.query.year || req.query.reporting_year);
  }
  if (req.query.month || req.query.reporting_month) {
    where.reporting_month = Number(req.query.month || req.query.reporting_month);
  }
  if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
    where.zonal_code = req.user.zonal_code;
  }
  if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
    where.state_code = req.user.state_code;
  }
  return where;
}

const geoInclude = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
];

const compileMaster = async (req, res, next) => {
  try {
    const where = scopeWhere(req);
    const [collationSheets, reconSheets] = await Promise.all([
      HmoIndebtednessReport.findAll({
        where,
        include: [...geoInclude, { model: HmoIndebtednessLine, as: "lines" }],
      }),
      HmoReconReport.findAll({
        where,
        include: [...geoInclude, { model: HmoReconLine, as: "lines" }],
      }),
    ]);
    const groups = buildMasterGroups(
      collationSheets.map((row) => row.toJSON()),
      reconSheets.map((row) => row.toJSON()),
    );
    res.json({ success: true, data: groups });
  } catch (err) { next(err); }
};

const listFacts = async (req, res, next) => {
  try {
    const where = scopeWhere(req);
    const clauses = [];
    const replacements = {};
    if (where.zonal_code) {
      clauses.push("zonal_code = :zonal_code");
      replacements.zonal_code = where.zonal_code;
    }
    if (where.state_code) {
      clauses.push("state_code = :state_code");
      replacements.state_code = where.state_code;
    }
    if (where.reporting_year) {
      clauses.push("reporting_year = :reporting_year");
      replacements.reporting_year = where.reporting_year;
    }
    if (where.reporting_month) {
      clauses.push("reporting_month = :reporting_month");
      replacements.reporting_month = where.reporting_month;
    }
    const sql = `
      SELECT * FROM hmo_indebtedness_facts_v
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY reporting_year DESC, reporting_month DESC, hmo_name, hcf_name, stream, measure
      LIMIT 5000
    `;
    const [rows] = await sequelize.query(sql, { replacements });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { compileMaster, listFacts };
