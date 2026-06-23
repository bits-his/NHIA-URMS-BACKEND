const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { User, ZonalOffice, StateOffice, Department, Unit, Role } = require("../models");
const { validateRoleKey, generateStaffId, KEY_RE, slugify } = require("../utils/roleService");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

// Helper: parse functionalities JSON on any user plain object
const parseUserFunctionalities = (u) => {
  if (typeof u.functionalities === "string") {
    try { u.functionalities = JSON.parse(u.functionalities); } catch { u.functionalities = []; }
  }
  if (!Array.isArray(u.functionalities)) u.functionalities = [];
  return u;
};

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

const listUsers = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.zone_id) where.zone_id = req.query.zone_id;
    if (req.query.state_id) where.state_id = req.query.state_id;
    if (req.query.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.search}%` } },
        { staff_id: { [Op.like]: `%${req.query.search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      attributes: { exclude: ["password"] },
      include: [
        { association: "zone",       attributes: ["id", "zonal_code", "description"] },
        { association: "state",      attributes: ["id", "code", "description"] },
        { association: "department", attributes: ["id", "department_code", "name"] },
        { association: "unit",       attributes: ["id", "unit_code", "name"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Parse functionalities JSON string → array for each row
    const data = rows.map(r => {
      const u = r.toJSON();
      if (typeof u.functionalities === "string") {
        try { u.functionalities = JSON.parse(u.functionalities); } catch { u.functionalities = []; }
      }
      if (!Array.isArray(u.functionalities)) u.functionalities = [];
      return u;
    });

    res.json({ success: true, data, total: count, page, pages: Math.ceil(count / limit) });
  } catch (err) { next(err); }
};

const getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: ["zone", "state", "department", "unit"],
    });
    if (!user) return notFound(res, "User");
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// Role → Staff ID prefix map (legacy fallback — prefer roles table)
const ROLE_PREFIX = {
  "admin":               "ADMIN",
  "state-officer":       "SO",
  "zonal-coordinator":   "ZC",
  "state-coordinator":   "SC",
  "department-officer":  "DO",
  "sdo":                 "SDO",
  "hq-department":       "HQ",
  "dg-ceo":              "DG",
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, zone_id, state_id, department_id, unit_id, access } = req.body;
    if (!name || !password || !role) {
      return res.status(400).json({ success: false, message: "name, password, role required" });
    }
    const roleCheck = await validateRoleKey(role);
    if (!roleCheck.ok) {
      return res.status(400).json({ success: false, message: roleCheck.message });
    }
    const staff_id = await generateStaffId(role);
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name, staff_id, email, password: hashed, role,
      zone_id, state_id, department_id, unit_id,
      functionalities: Array.isArray(access) ? access : [],
    });
    const { password: _pw, ...data } = user.toJSON();
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "email already exists" });
    }
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res, "User");

    const { name, email, role, zone_id, state_id, department_id, unit_id, is_active, password } = req.body;
    const updates = { name, email, role, zone_id, state_id, department_id, unit_id, is_active };
    if (password) updates.password = await bcrypt.hash(password, 12);

    // Remove undefined keys
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    if (updates.role) {
      const roleCheck = await validateRoleKey(updates.role);
      if (!roleCheck.ok) {
        return res.status(400).json({ success: false, message: roleCheck.message });
      }
    }

    await user.update(updates);
    const { password: _pw, ...data } = user.toJSON();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res, "User");
    if (user.id === req.user.id) {
      return res.status(403).json({ success: false, message: "You cannot deactivate your own account" });
    }
    await user.update({ is_active: false });
    const { password: _pw, ...data } = user.toJSON();
    res.json({ success: true, message: "User deactivated", data });
  } catch (err) { next(err); }
};

const activateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res, "User");
    await user.update({ is_active: true });
    const { password: _pw, ...data } = user.toJSON();
    res.json({ success: true, message: "User activated", data });
  } catch (err) { next(err); }
};

const updatePrivileges = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return notFound(res, "User");
    const { access } = req.body;
    if (!Array.isArray(access)) {
      return res.status(400).json({ success: false, message: "access must be an array of {access_to, functionalities[]}" });
    }
    // Validate shape
    for (const entry of access) {
      if (typeof entry.access_to !== "string" || !Array.isArray(entry.functionalities)) {
        return res.status(400).json({ success: false, message: "Each entry must have access_to (string) and functionalities (array)" });
      }
    }
    await user.update({ functionalities: access });
    const { password: _pw, ...data } = user.toJSON();
    res.json({ success: true, data: parseUserFunctionalities(data) });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ZONAL OFFICES
// ═══════════════════════════════════════════════════════════════════════════════

const listZones = async (req, res, next) => {
  try {
    const zones = await ZonalOffice.findAll({
      include: [{ association: "states", attributes: ["id", "code", "description"] }],
      order: [["zonal_code", "ASC"]],
    });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
};

const createZone = async (req, res, next) => {
  try {
    const { zonal_code, description } = req.body;
    if (!zonal_code || !description) {
      return res.status(400).json({ success: false, message: "zonal_code and description required" });
    }
    const zone = await ZonalOffice.create({ zonal_code, description });
    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "zonal_code already exists" });
    }
    next(err);
  }
};

const updateZone = async (req, res, next) => {
  try {
    const zone = await ZonalOffice.findByPk(req.params.id);
    if (!zone) return notFound(res, "Zone");
    await zone.update(req.body);
    res.json({ success: true, data: zone });
  } catch (err) { next(err); }
};

const deleteZone = async (req, res, next) => {
  try {
    const zone = await ZonalOffice.findByPk(req.params.id);
    if (!zone) return notFound(res, "Zone");
    await zone.destroy();
    res.json({ success: true, message: "Zone deleted" });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE OFFICES
// ═══════════════════════════════════════════════════════════════════════════════

const listStates = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.zone_id) where.zonal_id = req.query.zone_id;
    const states = await StateOffice.findAll({
      where,
      include: [{ association: "zone", attributes: ["id", "zonal_code", "description"] }],
      order: [["code", "ASC"]],
    });
    res.json({ success: true, data: states });
  } catch (err) { next(err); }
};

const createState = async (req, res, next) => {
  try {
    const { code, description, zonal_id } = req.body;
    if (!code || !description || !zonal_id) {
      return res.status(400).json({ success: false, message: "code, description, zonal_id required" });
    }
    const state = await StateOffice.create({ code, description, zonal_id });
    res.status(201).json({ success: true, data: state });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "State code already exists" });
    }
    next(err);
  }
};

const updateState = async (req, res, next) => {
  try {
    const state = await StateOffice.findByPk(req.params.id);
    if (!state) return notFound(res, "State");
    await state.update(req.body);
    res.json({ success: true, data: state });
  } catch (err) { next(err); }
};

const deleteState = async (req, res, next) => {
  try {
    const state = await StateOffice.findByPk(req.params.id);
    if (!state) return notFound(res, "State");
    await state.destroy();
    res.json({ success: true, message: "State deleted" });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

const listDepartments = async (req, res, next) => {
  try {
    const depts = await Department.findAll({
      include: [{ association: "units", attributes: ["id", "unit_code", "name"] }],
      order: [["department_code", "ASC"]],
    });
    res.json({ success: true, data: depts });
  } catch (err) { next(err); }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    // Auto-generate: DEPT-001, DEPT-002, ...
    const count = await Department.count();
    const department_code = `DEPT-${String(count + 1).padStart(3, "0")}`;
    const dept = await Department.create({ department_code, name, description });
    res.status(201).json({ success: true, data: dept });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "department_code already exists" });
    }
    next(err);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return notFound(res, "Department");
    await dept.update(req.body);
    res.json({ success: true, data: dept });
  } catch (err) { next(err); }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return notFound(res, "Department");
    await dept.destroy();
    res.json({ success: true, message: "Department deleted" });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UNITS
// ═══════════════════════════════════════════════════════════════════════════════

const listUnits = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.department_id) where.department_id = req.query.department_id;
    const units = await Unit.findAll({
      where,
      include: [{ association: "department", attributes: ["id", "department_code", "name"] }],
      order: [["unit_code", "ASC"]],
    });
    res.json({ success: true, data: units });
  } catch (err) { next(err); }
};

const createUnit = async (req, res, next) => {
  try {
    const { name, description, department_id } = req.body;
    if (!name || !department_id) {
      return res.status(400).json({ success: false, message: "name and department_id required" });
    }
    // Auto-generate: UNIT-001, UNIT-002, ...
    const count = await Unit.count();
    const unit_code = `UNIT-${String(count + 1).padStart(3, "0")}`;
    const unit = await Unit.create({ unit_code, name, description, department_id });
    res.status(201).json({ success: true, data: unit });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "unit_code already exists" });
    }
    next(err);
  }
};

const updateUnit = async (req, res, next) => {
  try {
    const unit = await Unit.findByPk(req.params.id);
    if (!unit) return notFound(res, "Unit");
    await unit.update(req.body);
    res.json({ success: true, data: unit });
  } catch (err) { next(err); }
};

const deleteUnit = async (req, res, next) => {
  try {
    const unit = await Unit.findByPk(req.params.id);
    if (!unit) return notFound(res, "Unit");
    await unit.destroy();
    res.json({ success: true, message: "Unit deleted" });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════════════════

const listRoles = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === "true") where.is_active = true;
    const roles = await Role.findAll({ where, order: [["label", "ASC"]] });
    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
};

const createRole = async (req, res, next) => {
  try {
    const { label, key, staff_id_prefix, report_scope, can_create_monthly, can_review_monthly, description } = req.body;
    if (!label?.trim()) {
      return res.status(400).json({ success: false, message: "label is required" });
    }
    const roleKey = (key?.trim() || slugify(label)).toLowerCase();
    if (!KEY_RE.test(roleKey)) {
      return res.status(400).json({ success: false, message: "key must be lowercase letters, numbers, and hyphens (e.g. audit-officer)" });
    }
    const prefix = (staff_id_prefix?.trim() || roleKey.split("-").map(w => w[0]?.toUpperCase()).join("").slice(0, 6) || "USR").toUpperCase();
    const role = await Role.create({
      key: roleKey,
      label: label.trim(),
      staff_id_prefix: prefix,
      report_scope: report_scope || "none",
      can_create_monthly: !!can_create_monthly,
      can_review_monthly: !!can_review_monthly,
      description: description || null,
      is_system: false,
      is_active: true,
    });
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "A role with this key already exists" });
    }
    next(err);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return notFound(res, "Role");

    const { label, staff_id_prefix, report_scope, can_create_monthly, can_review_monthly, description, is_active } = req.body;
    const updates = {
      label: label?.trim(),
      staff_id_prefix: staff_id_prefix?.trim()?.toUpperCase(),
      report_scope,
      can_create_monthly,
      can_review_monthly,
      description,
      is_active,
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    if (role.is_system && updates.label === undefined && Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    await role.update(updates);
    res.json({ success: true, data: role });
  } catch (err) { next(err); }
};

const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return notFound(res, "Role");
    if (role.is_system) {
      return res.status(403).json({ success: false, message: "System roles cannot be deleted" });
    }
    const usersCount = await User.count({ where: { role: role.key } });
    if (usersCount > 0) {
      return res.status(409).json({ success: false, message: `${usersCount} user(s) still have this role. Reassign them first.` });
    }
    await role.destroy();
    res.json({ success: true, message: "Role deleted" });
  } catch (err) { next(err); }
};

module.exports = {
  listUsers, getUser, createUser, updateUser, deactivateUser, activateUser, updatePrivileges,
  listZones, createZone, updateZone, deleteZone,
  listStates, createState, updateState, deleteState,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listUnits, createUnit, updateUnit, deleteUnit,
  listRoles, createRole, updateRole, deleteRole,
};

const notFound = (res, entity) =>
  res.status(404).json({ success: false, message: `${entity} not found` });
