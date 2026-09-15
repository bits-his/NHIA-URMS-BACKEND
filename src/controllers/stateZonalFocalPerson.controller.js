const { Op } = require("sequelize");
const {
  ZonalOffice, StateOffice, StateZonalFocalPerson,
} = require("../models");
const { DOMAINS, DESIGNATIONS } = require("../models/StateZonalFocalPerson");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] },
  { model: StateOffice, as: "state", attributes: ["id", "description", "code", "zonal_id"] },
];

function padId(n, width) {
  return String(n).padStart(width, "0");
}

function serialize(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    ...j,
    state_display_id: `ST-${padId(j.state_id, 3)}`,
    zone_display_id: `ZN-${padId(j.zone_id, 2)}`,
  };
}

function toInt(v, { allowNull = true } = {}) {
  if (v === undefined || v === null || v === "") return allowNull ? null : undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("Numeric fields must be zero or a positive number");
    err.status = 400;
    throw err;
  }
  return Math.round(n);
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

function requireEnum(v, allowed, label) {
  const s = String(v || "").trim();
  if (!allowed.includes(s)) {
    const err = new Error(`${label} is required`);
    err.status = 400;
    throw err;
  }
  return s;
}

async function resolveOfficeCodes(zone_id, state_id) {
  const [zone, state] = await Promise.all([
    ZonalOffice.findByPk(zone_id),
    StateOffice.findByPk(state_id),
  ]);
  if (!zone) {
    const err = new Error("Zone not found");
    err.status = 400;
    throw err;
  }
  if (!state) {
    const err = new Error("State not found");
    err.status = 400;
    throw err;
  }
  if (Number(state.zonal_id) !== Number(zone_id)) {
    const err = new Error("Selected state does not belong to the selected zone");
    err.status = 400;
    throw err;
  }
}

function uniqueConflict(err) {
  return err?.name === "SequelizeUniqueConstraintError"
    || String(err?.original?.code || "") === "ER_DUP_ENTRY";
}

function buildPayload(scoped, user) {
  const reporting_year = toInt(scoped.reporting_year, { allowNull: false });
  const zone_id = toInt(scoped.zone_id, { allowNull: false });
  const state_id = toInt(scoped.state_id, { allowNull: false });
  if (!reporting_year || !zone_id || !state_id) {
    const err = new Error("Year, zone, and state are required");
    err.status = 400;
    throw err;
  }
  const officer_name = strOrNull(scoped.officer_name, 150);
  if (!officer_name) {
    const err = new Error("Name of Office is required");
    err.status = 400;
    throw err;
  }
  return {
    reporting_year,
    zone_id,
    state_id,
    domain: requireEnum(scoped.domain, DOMAINS, "Domain"),
    officer_name,
    designation: requireEnum(scoped.designation, DESIGNATIONS, "Designation"),
    email: emailOrNull(scoped.email),
    phone: strOrNull(scoped.phone, 40),
    created_by: user?.name || user?.staff_id || null,
  };
}

const listRecords = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    delete where.status;
    delete where.reporting_month;
    delete where.against_type;
    if (req.query.domain && DOMAINS.includes(req.query.domain)) {
      where.domain = req.query.domain;
    }
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [
        { officer_name: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { phone: { [Op.like]: q } },
      ];
    }
    const rows = await StateZonalFocalPerson.findAll({
      where,
      include: includeGeo,
      order: [["reporting_year", "DESC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: rows.map(serialize) });
  } catch (err) { next(err); }
};

const getRecord = async (req, res, next) => {
  try {
    const row = await StateZonalFocalPerson.findByPk(req.params.id, { include: includeGeo });
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    res.json({ success: true, data: serialize(row) });
  } catch (err) { next(err); }
};

const createRecord = async (req, res, next) => {
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const payload = buildPayload(scoped, req.user);
    await resolveOfficeCodes(payload.zone_id, payload.state_id);
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
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, { ...row.toJSON(), ...req.body });
    const payload = buildPayload(scoped, req.user);
    await resolveOfficeCodes(payload.zone_id, payload.state_id);
    delete payload.created_by;
    await row.update(payload);
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

module.exports = { listRecords, getRecord, createRecord, updateRecord };
