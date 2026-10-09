const { Op } = require("sequelize");
const { User } = require("../models/User");
const { Department, Unit } = require("../models");
const AppNotification = require("../models/AppNotification");

const ENFORCEMENT_TARGET = "Enforcement Department";
const STATE_COORDINATOR_TARGET = "State Coordinator";
const ZONAL_COORDINATOR_TARGET = "Zonal Office";

let synced = false;
async function ensureNotificationTable() {
  if (synced) return;
  await AppNotification.sync({ alter: true });
  synced = true;
}

function parseOfficerLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return { name: null, staffId: null };
  const staffMatch = raw.match(/\(([^)]+)\)/);
  const staffId = staffMatch ? staffMatch[1].trim() : null;
  const name = raw.replace(/\s*\([^)]*\)\s*/g, "").replace(/\s*—.*$/, "").trim();
  return { name: name || raw, staffId };
}

function isEnforcementEscalationTarget(label) {
  const raw = String(label || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "enf" || raw === "enforcement department") return true;
  if (raw.includes("enforcement")) return true;
  return false;
}

function isStateCoordinatorEscalationTarget(label) {
  const raw = String(label || "").trim().toLowerCase();
  return raw === "state coordinator" || raw === "state-coordinator";
}

function isZonalCoordinatorEscalationTarget(label) {
  const raw = String(label || "").trim().toLowerCase();
  return raw === "zonal office"
    || raw === "zonal coordinator"
    || raw === "zonal-coordinator";
}

function isRoleEscalationInbox(label) {
  return isEnforcementEscalationTarget(label)
    || isStateCoordinatorEscalationTarget(label)
    || isZonalCoordinatorEscalationTarget(label);
}

function isCoordinatorRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "state-coordinator"
    || r.endsWith("-state-coordinator")
    || r === "zonal-coordinator"
    || r.endsWith("-zonal-coordinator");
}

async function findUsersForOfficerLabel(label) {
  const { name, staffId } = parseOfficerLabel(label);
  if (!name && !staffId) return [];
  const clauses = [];
  if (staffId) clauses.push({ staff_id: staffId });
  if (name) {
    clauses.push({ name });
    clauses.push({ name: { [Op.like]: `${name}%` } });
  }
  return User.findAll({
    where: { is_active: true, [Op.or]: clauses },
    attributes: ["id", "name", "staff_id"],
    limit: 5,
  });
}

async function findEnforcementDepartmentIds() {
  const enfDepts = await Department.findAll({
    where: {
      [Op.or]: [
        { department_code: { [Op.in]: ["ENF", "AUD"] } },
        { name: { [Op.like]: "%Enforcement%" } },
      ],
    },
    attributes: ["id"],
  });
  return enfDepts.map((d) => d.id);
}

async function findEnforcementUserIds() {
  const enfDeptIds = await findEnforcementDepartmentIds();
  const enfUnitWhere = [
    { unit_code: { [Op.like]: "ENF%" } },
    { unit_code: "AUD-COMP" },
    { name: { [Op.like]: "%Enforcement%" } },
    { name: { [Op.like]: "%compliance & enforcement%" } },
  ];
  if (enfDeptIds.length) enfUnitWhere.push({ department_id: { [Op.in]: enfDeptIds } });
  const enfUnits = await Unit.findAll({ where: { [Op.or]: enfUnitWhere }, attributes: ["id"] });
  const enfUnitIds = enfUnits.map((u) => u.id);

  const or = [];
  if (enfDeptIds.length) or.push({ department_id: { [Op.in]: enfDeptIds } });
  if (enfUnitIds.length) or.push({ unit_id: { [Op.in]: enfUnitIds } });
  if (!or.length) return [];

  const users = await User.findAll({
    where: { is_active: true, [Op.or]: or },
    attributes: ["id"],
    limit: 500,
  });
  return users.map((u) => u.id);
}

async function findUsersByDepartmentLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return [];
  if (isEnforcementEscalationTarget(raw)) {
    const ids = await findEnforcementUserIds();
    return ids.map((id) => ({ id }));
  }

  const codeMatch = raw.match(/\(([^)]+)\)/);
  const code = (codeMatch ? codeMatch[1] : raw).trim();
  const name = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();

  const deptWhere = [];
  if (code) deptWhere.push({ department_code: code });
  if (name) {
    deptWhere.push({ name });
    deptWhere.push({ name: { [Op.like]: `%${name}%` } });
  }
  const depts = await Department.findAll({
    where: { [Op.or]: deptWhere },
    attributes: ["id"],
    limit: 20,
  });
  const deptIds = depts.map((d) => d.id);
  if (!deptIds.length) return [];

  return User.findAll({
    where: { is_active: true, department_id: { [Op.in]: deptIds } },
    attributes: ["id", "name", "staff_id"],
    limit: 500,
  });
}

async function notifyUsers(userIds, payload) {
  await ensureNotificationTable();
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (!unique.length) return [];
  const rows = await AppNotification.bulkCreate(
    unique.map((user_id) => ({
      user_id,
      title: payload.title,
      body: payload.body || null,
      type: payload.type || "alert",
      link: payload.link || null,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      read: false,
    })),
  );
  return rows;
}

async function notifyOfficerLabel(label, payload) {
  const users = await findUsersForOfficerLabel(label);
  if (!users.length) return [];
  return notifyUsers(users.map((u) => u.id), payload);
}

async function findStateCoordinatorUserIds(stateId) {
  if (!stateId) return [];
  const users = await User.findAll({
    where: {
      is_active: true,
      state_id: stateId,
      [Op.or]: [
        { role: "state-coordinator" },
        { role: { [Op.like]: "%-state-coordinator" } },
      ],
    },
    attributes: ["id"],
    limit: 100,
  });
  return users.map((u) => u.id);
}

async function findZonalCoordinatorUserIds(zoneId) {
  if (!zoneId) return [];
  const users = await User.findAll({
    where: {
      is_active: true,
      zone_id: zoneId,
      [Op.or]: [
        { role: "zonal-coordinator" },
        { role: { [Op.like]: "%-zonal-coordinator" } },
      ],
    },
    attributes: ["id"],
    limit: 100,
  });
  return users.map((u) => u.id);
}

/**
 * Notify a role inbox / department / person when a complaint is escalated.
 * @param {string} label
 * @param {object} payload
 * @param {{ stateId?: number|null, zoneId?: number|null }} [geo]
 */
async function notifyEscalationTarget(label, payload, geo = {}) {
  if (isStateCoordinatorEscalationTarget(label)) {
    const ids = await findStateCoordinatorUserIds(geo.stateId);
    if (ids.length) return notifyUsers(ids, payload);
  }
  if (isZonalCoordinatorEscalationTarget(label)) {
    const ids = await findZonalCoordinatorUserIds(geo.zoneId);
    if (ids.length) return notifyUsers(ids, payload);
  }
  const users = await findUsersByDepartmentLabel(label);
  if (!users.length) {
    return notifyOfficerLabel(label, payload);
  }
  return notifyUsers(users.map((u) => u.id), payload);
}

module.exports = {
  ensureNotificationTable,
  findUsersForOfficerLabel,
  findUsersByDepartmentLabel,
  findEnforcementUserIds,
  findStateCoordinatorUserIds,
  findZonalCoordinatorUserIds,
  notifyUsers,
  notifyOfficerLabel,
  notifyEscalationTarget,
  isEnforcementEscalationTarget,
  isStateCoordinatorEscalationTarget,
  isZonalCoordinatorEscalationTarget,
  isRoleEscalationInbox,
  isCoordinatorRole,
  ENFORCEMENT_TARGET,
  STATE_COORDINATOR_TARGET,
  ZONAL_COORDINATOR_TARGET,
  AppNotification,
};
