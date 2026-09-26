const { Op } = require("sequelize");
const { User } = require("../models/User");
const AppNotification = require("../models/AppNotification");

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

module.exports = {
  ensureNotificationTable,
  findUsersForOfficerLabel,
  notifyUsers,
  notifyOfficerLabel,
  AppNotification,
};
