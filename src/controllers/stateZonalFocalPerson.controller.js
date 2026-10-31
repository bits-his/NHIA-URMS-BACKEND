const { Op } = require("sequelize");
const {
  ZonalOffice,
  StateOffice,
  StateZonalFocalPerson,
} = require("../models/active");
const { DOMAINS, DESIGNATIONS } = require("../models/StateZonalFocalPerson");
const { resolveOfficeGeo } = require("../utils/officeProfileGeo");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
];

function serialize(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    ...j,
    state_id: j.state_id || j.state_code,
    zone_id: j.zone_id || j.zonal_code,
    state_display_id: j.state_code ? `ST-${j.state_code}` : `ST-${j.state_id || ""}`,
    zone_display_id: j.zonal_code ? `ZN-${j.zonal_code}` : `ZN-${j.zone_id || ""}`,
  };
}

function emailOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    const err = new Error("Enter a valid email address");
    err.status = 400;
    throw err;
  }
  return s;
}

function strOrNull(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}

function uniqueConflict(err) {
  return (
    err?.name === "SequelizeUniqueConstraintError" ||
    String(err?.original?.code || "") === "ER_DUP_ENTRY"
  );
}

const listRecords = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.query);
    const where = {};
    if (geo.state_code) where.state_code = geo.state_code;
    else if (geo.zonal_code) where.zonal_code = geo.zonal_code;

    if (req.query.year || req.query.reporting_year) {
      where.reporting_year = Number(req.query.year || req.query.reporting_year);
    }
    if (req.query.domain) {
      where.domain = req.query.domain;
    }
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [
        { officer_name: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { phone: { [Op.like]: q } },
        { designation: { [Op.like]: q } },
      ];
    }
    const rows = await StateZonalFocalPerson.findAll({
      where,
      include: includeGeo,
      order: [["reporting_year", "DESC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: rows.map(serialize) });
  } catch (err) {
    next(err);
  }
};

const getRecord = async (req, res, next) => {
  try {
    const row = await StateZonalFocalPerson.findByPk(req.params.id, { include: includeGeo });
    if (!row) {
      return res.status(404).json({ success: false, message: "Focal person not found" });
    }
    res.json({ success: true, data: serialize(row) });
  } catch (err) {
    next(err);
  }
};

const createRecord = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.body);
    if (!geo.state_code || !geo.zonal_code) {
      return res.status(400).json({ success: false, message: "State and Zone are required" });
    }
    const reporting_year = Number(req.body.reporting_year || new Date().getFullYear());
    const officer_name = strOrNull(req.body.officer_name, 150);
    if (!officer_name) {
      return res.status(400).json({ success: false, message: "Officer name is required" });
    }
    const domain = strOrNull(req.body.domain, 100);
    if (!domain) {
      return res.status(400).json({ success: false, message: "Domain is required" });
    }
    const designation = strOrNull(req.body.designation, 100) || "officer_i";

    const payload = {
      reporting_year,
      zonal_code: geo.zonal_code,
      state_code: geo.state_code,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      domain,
      officer_name,
      designation,
      email: emailOrNull(req.body.email),
      phone: strOrNull(req.body.phone, 40),
      created_by: req.user?.name || req.user?.staff_id || null,
      created_by_user_id: req.user?.id || null,
    };

    const row = await StateZonalFocalPerson.create(payload);
    const full = await StateZonalFocalPerson.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: serialize(full) });
  } catch (err) {
    if (uniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: "A focal person already exists for this state, year, and domain.",
      });
    }
    next(err);
  }
};

const updateRecord = async (req, res, next) => {
  try {
    const row = await StateZonalFocalPerson.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Focal person not found" });
    }

    const updates = {};
    if (req.body.officer_name !== undefined) updates.officer_name = strOrNull(req.body.officer_name, 150);
    if (req.body.designation !== undefined) updates.designation = strOrNull(req.body.designation, 100);
    if (req.body.domain !== undefined) updates.domain = strOrNull(req.body.domain, 100);
    if (req.body.email !== undefined) updates.email = emailOrNull(req.body.email);
    if (req.body.phone !== undefined) updates.phone = strOrNull(req.body.phone, 40);

    await row.update(updates);
    const full = await StateZonalFocalPerson.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: serialize(full) });
  } catch (err) {
    if (uniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: "A focal person already exists for this state, year, and domain.",
      });
    }
    next(err);
  }
};

/**
 * Save entire focal person roster for a state and reporting year (batch upsert).
 */
const saveRoster = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.body);
    if (!geo.state_code || !geo.zonal_code) {
      return res.status(400).json({ success: false, message: "State and Zone are required" });
    }
    const reporting_year = Number(req.body.reporting_year || new Date().getFullYear());
    const roster = Array.isArray(req.body.roster) ? req.body.roster : [];

    const results = [];
    for (const item of roster) {
      if (!item.domain || !item.officer_name) continue;
      const existing = await StateZonalFocalPerson.findOne({
        where: {
          state_code: geo.state_code,
          reporting_year,
          domain: item.domain,
        },
      });

      const fields = {
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        zone_id: geo.zone_id,
        state_id: geo.state_id,
        reporting_year,
        domain: item.domain,
        officer_name: item.officer_name,
        designation: item.designation || "officer_i",
        email: item.email || null,
        phone: item.phone || null,
        created_by: req.user?.name || req.user?.staff_id || null,
        created_by_user_id: req.user?.id || null,
      };

      if (existing) {
        await existing.update(fields);
        results.push(existing);
      } else {
        const created = await StateZonalFocalPerson.create(fields);
        results.push(created);
      }
    }

    const fullList = await StateZonalFocalPerson.findAll({
      where: { state_code: geo.state_code, reporting_year },
      include: includeGeo,
    });
    res.json({ success: true, data: fullList.map(serialize) });
  } catch (err) {
    next(err);
  }
};

const deleteRecord = async (req, res, next) => {
  try {
    const row = await StateZonalFocalPerson.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Focal person not found" });
    }
    await row.destroy();
    res.json({ success: true, message: "Focal person deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  saveRoster,
  deleteRecord,
  DOMAINS,
  DESIGNATIONS,
};
