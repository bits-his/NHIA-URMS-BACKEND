const { Op } = require("sequelize");
const { ZonalOffice, StateOffice, StateZonalOfficeProfile } = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");
const { removeAopFile } = require("../middleware/officeProfileUpload");

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
    annual_budget: j.annual_budget == null ? null : Number(j.annual_budget),
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

function toMoney(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("Annual Budget must be a valid number");
    err.status = 400;
    throw err;
  }
  return n;
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
  return { zone, state };
}

function aopFields(file) {
  if (!file) return {};
  return {
    aop_original_name: file.originalname,
    aop_file_name: file.filename,
    aop_file_path: `/uploads/office-profiles/${file.filename}`,
    aop_mime: file.mimetype,
  };
}

function uniqueConflict(err) {
  return err?.name === "SequelizeUniqueConstraintError"
    || String(err?.original?.code || "") === "ER_DUP_ENTRY";
}

const listProfiles = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    delete where.status;
    delete where.reporting_month;
    delete where.against_type;
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [
        { coordinator_name: { [Op.like]: q } },
        { office_email: { [Op.like]: q } },
        { coordinator_email: { [Op.like]: q } },
        { office_address: { [Op.like]: q } },
      ];
    }
    const rows = await StateZonalOfficeProfile.findAll({
      where,
      include: includeGeo,
      order: [["reporting_year", "DESC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: rows.map(serialize) });
  } catch (err) { next(err); }
};

const getProfile = async (req, res, next) => {
  try {
    const row = await StateZonalOfficeProfile.findByPk(req.params.id, { include: includeGeo });
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    res.json({ success: true, data: serialize(row) });
  } catch (err) { next(err); }
};

const createProfile = async (req, res, next) => {
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const reporting_year = toInt(scoped.reporting_year, { allowNull: false });
    const zone_id = toInt(scoped.zone_id, { allowNull: false });
    const state_id = toInt(scoped.state_id, { allowNull: false });
    if (!reporting_year || !zone_id || !state_id) {
      const err = new Error("Year, zone, and state are required");
      err.status = 400;
      throw err;
    }
    await resolveOfficeCodes(zone_id, state_id);

    const payload = {
      reporting_year,
      zone_id,
      state_id,
      staff_strength: toInt(scoped.staff_strength),
      coordinator_name: strOrNull(scoped.coordinator_name, 150),
      coordinator_phone: strOrNull(scoped.coordinator_phone, 40),
      coordinator_email: emailOrNull(scoped.coordinator_email),
      office_address: strOrNull(scoped.office_address, 500),
      office_email: emailOrNull(scoped.office_email),
      enrolment_target: toInt(scoped.enrolment_target),
      annual_budget: toMoney(scoped.annual_budget),
      created_by: req.user?.name || req.user?.staff_id || null,
      ...aopFields(req.file),
    };

    const row = await StateZonalOfficeProfile.create(payload);
    const full = await StateZonalOfficeProfile.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: serialize(full) });
  } catch (err) {
    if (req.file) removeAopFile(`/uploads/office-profiles/${req.file.filename}`);
    if (uniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this state office and reporting year.",
      });
    }
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const row = await StateZonalOfficeProfile.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    const reporting_year = toInt(scoped.reporting_year ?? row.reporting_year, { allowNull: false });
    const zone_id = toInt(scoped.zone_id ?? row.zone_id, { allowNull: false });
    const state_id = toInt(scoped.state_id ?? row.state_id, { allowNull: false });
    await resolveOfficeCodes(zone_id, state_id);

    const next = {
      reporting_year,
      zone_id,
      state_id,
      staff_strength: toInt(scoped.staff_strength),
      coordinator_name: strOrNull(scoped.coordinator_name, 150),
      coordinator_phone: strOrNull(scoped.coordinator_phone, 40),
      coordinator_email: emailOrNull(scoped.coordinator_email),
      office_address: strOrNull(scoped.office_address, 500),
      office_email: emailOrNull(scoped.office_email),
      enrolment_target: toInt(scoped.enrolment_target),
      annual_budget: toMoney(scoped.annual_budget),
    };

    if (req.file) {
      removeAopFile(row.aop_file_path);
      Object.assign(next, aopFields(req.file));
    } else if (String(scoped.remove_aop) === "true" || String(scoped.remove_aop) === "1") {
      removeAopFile(row.aop_file_path);
      next.aop_original_name = null;
      next.aop_file_name = null;
      next.aop_file_path = null;
      next.aop_mime = null;
    }

    await row.update(next);
    const full = await StateZonalOfficeProfile.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: serialize(full) });
  } catch (err) {
    if (req.file) removeAopFile(`/uploads/office-profiles/${req.file.filename}`);
    if (uniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this state office and reporting year.",
      });
    }
    next(err);
  }
};

const deleteProfile = async (req, res, next) => {
  try {
    const row = await StateZonalOfficeProfile.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    removeAopFile(row.aop_file_path);
    await row.destroy();
    res.json({ success: true, message: "Profile deleted" });
  } catch (err) { next(err); }
};

module.exports = { listProfiles, getProfile, createProfile, updateProfile, deleteProfile };
