const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { Challenge, SupportRequest, RecordHistory } = require("../models/ChallengesSupport");
const { StateOffice, ZonalOffice, User } = require("../models");
const FormDocument = require("../models/shared/FormDocument");
const AppNotification = require("../models/AppNotification");
const { NATIONAL, fail, reference, text, scopeWhere, assertScope } = require("../utils/enrolmentDriveWorkflow");
const { grantForFunctionality } = require("../middleware/stateOfficeAccess");
const T = require("../utils/challengesSupportTypes");

const respond = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
};
const dateOnly = (value, label, required = false) => {
  const v = String(value ?? "").slice(0, 10);
  if (!v) { if (required) throw fail(`${label} is required`); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw fail(`Enter a valid ${label.toLowerCase()}`);
  return v;
};
const actorName = (user) => user.name || user.staff_id || String(user.id);
const ZONAL_COORDINATOR = /zonal-coordinator|^zc$|-zonal-coordinator/;

function parseAccess(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}
function hasChallengesAccess(user) {
  if (NATIONAL.has(user?.role)) return true;
  return grantForFunctionality(parseAccess(user?.functionalities), "Challenges & Recommendations");
}
function canCreate(user) {
  return user?.role === "admin" || (hasChallengesAccess(user) && !["dg-ceo"].includes(user?.role) && !ZONAL_COORDINATOR.test(user?.role || ""));
}
/** Per the deck: State Office reports; Zonal Coordinator comments; SDO/HQ acts. */
function isZonalCoordinator(user) { return ZONAL_COORDINATOR.test(user?.role || "") || user?.role_config?.report_scope === "zonal"; }
function canComment(user) { return hasChallengesAccess(user) && user?.role !== "dg-ceo" && (NATIONAL.has(user?.role) || isZonalCoordinator(user)); }
function canAssign(user) { return NATIONAL.has(user?.role) && user?.role !== "dg-ceo"; }

async function allowedChallenge(id, user, transaction) {
  const row = await Challenge.findByPk(id, { transaction });
  if (!row) throw fail("Challenge not found", 404);
  assertScope(user, row);
  return row;
}
async function allowedSupport(id, user, transaction) {
  const row = await SupportRequest.findByPk(id, { transaction });
  if (!row) throw fail("Support request not found", 404);
  assertScope(user, row);
  return row;
}
async function notify(userIds, title, body, link) {
  if (!userIds.length) return;
  await AppNotification.bulkCreate(userIds.map((id) => ({ user_id: id, title, body, type: "challenges", link })));
}
/** SDO (national) + zonal coordinators of the record's zone */
async function alertUsersFor(row) {
  const where = { is_active: true, [Op.or]: [{ role: { [Op.in]: ["sdo"] } }, { zonal_code: row.zonal_code, role: { [Op.regexp]: "zonal" } }] };
  const users = await User.findAll({ where, attributes: ["id"] });
  return users.map((u) => u.id);
}

const catalogue = respond(async (req, res) => {
  const scope = scopeWhere(req.user);
  const states = await StateOffice.findAll({
    where: scope.state_code ? { code: scope.state_code } : scope.zonal_code ? { zonal_code: scope.zonal_code } : {},
    attributes: ["code", "description", "zonal_code"], order: [["description", "ASC"]],
  });
  const zones = await ZonalOffice.findAll({ where: { zonal_code: { [Op.in]: [...new Set(states.map((s) => s.zonal_code))] } }, attributes: ["zonal_code", "description"], order: [["description", "ASC"]] });
  res.json({ success: true, data: {
    ...T,
    states, zones,
    default_state: scope.state_code || req.user.state_code || null,
    default_zone: scope.zonal_code || req.user.zonal_code || null,
    permissions: {
      user_id: req.user.id,
      create: canCreate(req.user),
      comment: canComment(req.user),
      assign: canAssign(req.user),
      zonal: isZonalCoordinator(req.user),
      national: NATIONAL.has(req.user.role),
    },
  } });
});

const listChallenges = respond(async (req, res) => {
  const where = { ...scopeWhere(req.user) };
  for (const [q, col] of [["status", "status"], ["severity", "severity"], ["category", "category_key"], ["state", "state_code"]]) {
    if (req.query[q]) where[col] = req.query[q];
  }
  const rows = await Challenge.findAll({
    where,
    include: [{ model: SupportRequest, as: "support_requests", attributes: ["support_id", "status", "support_category", "specific_support", "priority", "required_by_date"] }],
    order: [["date_reported", "DESC"], ["createdAt", "DESC"]],
  });
  res.json({ success: true, data: rows });
});

const challengeFields = (body) => {
  const categoryLabel = text(body.challenge_category, 100);
  const cat = T.CHALLENGE_CATEGORIES.find((c) => c.label === categoryLabel || c.key === categoryLabel);
  if (!cat && categoryLabel !== T.OTHER_OPTION) throw fail("Select a valid challenge category");
  const catKey = cat ? cat.key : "Other";
  const catLabel = cat ? cat.label : "Other";
  const specific = text(body.specific_challenge, 200);
  if (specific && specific !== T.OTHER_OPTION && cat && !(T.CHALLENGE_SPECIFICS[catKey] || []).includes(specific)) throw fail("Select a specific challenge from the chosen category");
  if ((catKey === "Other" || specific === T.OTHER_OPTION) && !text(body.other_challenge)) throw fail("Specify the challenge");
  const status = text(body.status, 40) || "In-progress";
  if (!T.CHALLENGE_STATUSES.includes(status)) throw fail("Select a valid challenge status");
  for (const [key, allowed, label] of [
    ["severity", T.CHALLENGE_SEVERITIES, "severity"], ["impact", T.CHALLENGE_IMPACTS, "impact"],
    ["related_activity", T.CHALLENGE_RELATED_ACTIVITIES, "related activity"],
    ["programme", T.CHALLENGE_PROGRAMS, "programme"],
    ["escalation_department", T.CHALLENGE_DEPARTMENTS, "escalation department"],
  ]) {
    const v = text(body[key], 200);
    if (v && !allowed.includes(v)) throw fail(`Select a valid ${label}`);
  }
  return {
    date_reported: dateOnly(body.date_reported || new Date().toISOString(), "Date reported", true),
    related_activity: text(body.related_activity, 120) || null,
    programme: text(body.programme, 80) || null,
    category_key: catKey, category_label: catLabel,
    specific_challenge: specific || null,
    other_challenge: text(body.other_challenge, 255) || null,
    severity: text(body.severity, 20) || null,
    impact: text(body.impact, 120) || null,
    status,
    escalation_department: text(body.escalation_department, 80) || null,
    description: text(body.description ?? body.challenge_details, 10000) || null,
    key_recommendation: text(body.key_recommendation, 5000) || null,
    support_context: text(body.support_context, 5000) || null,
    remarks: text(body.remarks, 5000) || null,
  };
};

const createChallenge = respond(async (req, res) => {
  if (!canCreate(req.user)) throw fail("You do not have permission to record challenges", 403);
  const scope = scopeWhere(req.user);
  const state = await StateOffice.findByPk(req.body.state_code || scope.state_code);
  if (!state) throw fail("Select a valid state");
  assertScope(req.user, { state_code: state.code, zonal_code: state.zonal_code });
  const fields = challengeFields(req.body);
  let row;
  await sequelize.transaction(async (transaction) => {
    row = await Challenge.create({
      ...fields, challenge_id: reference("CH"),
      state_code: state.code, zonal_code: state.zonal_code,
      created_by_user_id: req.user.id, created_by_name: actorName(req.user),
    }, { transaction });
    await RecordHistory.create({ history_id: reference("HST"), challenge_id: row.challenge_id, action: "create", to_status: row.status, actor_user_id: req.user.id, actor_name: actorName(req.user) }, { transaction });
  });
  res.status(201).json({ success: true, data: row });
});

const getChallenge = respond(async (req, res) => {
  const row = await allowedChallenge(req.params.id, req.user);
  const [support, history, documents] = await Promise.all([
    SupportRequest.findAll({ where: { challenge_id: row.challenge_id }, order: [["date_submitted", "DESC"]] }),
    RecordHistory.findAll({ where: { challenge_id: row.challenge_id }, order: [["createdAt", "DESC"]] }),
    FormDocument.findAll({ where: { form_key: "challenges", report_reference_id: row.challenge_id } }),
  ]);
  res.json({ success: true, data: { ...row.toJSON(), support_requests: support, history, documents } });
});

const updateChallenge = respond(async (req, res) => {
  let row;
  await sequelize.transaction(async (transaction) => {
    row = await allowedChallenge(req.params.id, req.user, transaction);
    if (row.created_by_user_id !== req.user.id && !canAssign(req.user)) throw fail("You can only edit challenges you recorded", 403);
    const fields = challengeFields(req.body);
    const statusChanged = fields.status !== row.status;
    await row.update(fields, { transaction });
    if (statusChanged) {
      await RecordHistory.create({ history_id: reference("HST"), challenge_id: row.challenge_id, action: "status", from_status: fields.status === row.status ? row.status : req.body.previous_status || row.status, to_status: fields.status, note: text(req.body.note, 5000) || null, actor_user_id: req.user.id, actor_name: actorName(req.user) }, { transaction });
    }
  });
  res.json({ success: true, data: row });
});

const addChallengeActivity = respond(async (req, res) => {
  if (!canComment(req.user)) throw fail("You do not have permission to update this challenge", 403);
  const row = await allowedChallenge(req.params.id, req.user);
  const action = text(req.body.action, 30);
  const note = text(req.body.note, 5000);
  if (action === "comment") {
    if (!note) throw fail("Enter a comment");
    const entry = await RecordHistory.create({ history_id: reference("HST"), challenge_id: row.challenge_id, action: "comment", note, actor_user_id: req.user.id, actor_name: actorName(req.user) });
    await notify([row.created_by_user_id].filter((id) => id !== req.user.id), `Comment on ${row.challenge_id}`, note.slice(0, 300), `/zonal/challenges/${row.challenge_id}`);
    return res.status(201).json({ success: true, data: entry });
  }
  const newStatus = text(req.body.status, 40);
  if (!T.CHALLENGE_STATUSES.includes(newStatus)) throw fail("Select a valid challenge status");
  const isOwner = row.created_by_user_id === req.user.id;
  if (!isOwner && !canAssign(req.user)) throw fail("Only the recording officer or SDO/HQ can change status", 403);
  await sequelize.transaction(async (transaction) => {
    await row.update({ status: newStatus }, { transaction });
    await RecordHistory.create({ history_id: reference("HST"), challenge_id: row.challenge_id, action: "status", from_status: req.body.from_status || row.status, to_status: newStatus, note: note || null, actor_user_id: req.user.id, actor_name: actorName(req.user) }, { transaction });
  });
  if (["Critical", "Escalated"].includes(newStatus) || row.severity === "Critical") {
    const ids = await alertUsersFor(row);
    await notify(ids.filter((id) => id !== req.user.id), `Challenge ${row.challenge_id} marked ${newStatus}`, `${row.category_label}: ${row.specific_challenge || row.other_challenge || ""}`.slice(0, 300), `/zonal/challenges/${row.challenge_id}`);
  }
  res.json({ success: true, data: row });
});

const listSupport = respond(async (req, res) => {
  const where = { ...scopeWhere(req.user) };
  for (const [q, col] of [["status", "status"], ["priority", "priority"], ["category", "support_category"], ["owner", "action_required_from"], ["state", "state_code"], ["challenge", "challenge_id"]]) {
    if (req.query[q]) where[col] = req.query[q];
  }
  const rows = await SupportRequest.findAll({ where, include: [{ model: Challenge, as: "challenge", attributes: ["challenge_id", "category_label", "specific_challenge", "severity", "status"] }], order: [["date_submitted", "DESC"], ["createdAt", "DESC"]] });
  res.json({ success: true, data: rows });
});

const supportFields = async (body, user, transaction) => {
  const category = text(body.support_category, 120);
  if (![...T.SUPPORT_CATEGORIES, T.OTHER_OPTION].includes(category)) throw fail("Select a valid support category");
  const specific = text(body.specific_support, 200);
  if (category !== T.OTHER_OPTION && specific && specific !== T.OTHER_OPTION && !(T.SUPPORT_CATEGORY_SPECIFICS[category] || []).includes(specific)) throw fail("Select a support option from the chosen category");
  if ((category === T.OTHER_OPTION || category === "Others" || specific === T.OTHER_OPTION) && !text(body.other_support)) throw fail("Specify the support required");
  const owner = text(body.action_required_from, 60);
  if (!T.SUPPORT_ACTION_OWNERS.includes(owner)) throw fail("Select who action is required from");
  if (owner === "Other NHIA Departments") {
    const dept = text(body.nhia_department, 80);
    if (!T.CHALLENGE_DEPARTMENTS.includes(dept)) throw fail("Select the NHIA department");
  }
  if (owner === T.OTHER_OPTION && !text(body.other_action_owner)) throw fail("Specify who action is required from");
  const priority = text(body.priority, 20);
  if (priority && !T.SUPPORT_PRIORITIES.includes(priority)) throw fail("Select a valid priority");
  let challenge = null;
  const challengeId = text(body.challenge_id, 30);
  if (challengeId) {
    challenge = await allowedChallenge(challengeId, user, transaction);
  }
  return {
    challenge_id: challenge ? challenge.challenge_id : null,
    date_submitted: dateOnly(body.date_submitted || new Date().toISOString(), "Date submitted", true),
    action_required_from: owner,
    other_action_owner: text(body.other_action_owner, 255) || null,
    nhia_department: owner === "Other NHIA Departments" ? text(body.nhia_department, 80) : null,
    support_category: category,
    specific_support: specific || null,
    other_support: text(body.other_support, 255) || null,
    priority: priority || (challenge ? challenge.severity : null) || "Medium",
    description: text(body.description, 10000) || null,
    operational_impact: text(body.operational_impact, 200) || (challenge ? challenge.impact : null),
    required_by_date: dateOnly(body.required_by_date, "required-by date"),
    status: "Submitted",
    challenge,
  };
};

const createSupport = respond(async (req, res) => {
  if (!canCreate(req.user)) throw fail("You do not have permission to raise support requests", 403);
  let row;
  const created = await sequelize.transaction(async (transaction) => {
    const { challenge, ...fields } = await supportFields(req.body, req.user, transaction);
    const scope = scopeWhere(req.user);
    const stateCode = challenge ? challenge.state_code : req.body.state_code || scope.state_code;
    const state = challenge ? await StateOffice.findByPk(challenge.state_code, { transaction }) : await StateOffice.findByPk(stateCode, { transaction });
    if (!state) throw fail("Select a valid state");
    if (!challenge) assertScope(req.user, { state_code: state.code, zonal_code: state.zonal_code });
    row = await SupportRequest.create({
      ...fields, support_id: reference("SUP"),
      state_code: state.code, zonal_code: state.zonal_code,
      submitted_by_user_id: req.user.id, submitted_by_name: actorName(req.user),
    }, { transaction });
    await RecordHistory.create({ history_id: reference("HST"), support_id: row.support_id, action: "create", to_status: row.status, note: challenge ? `Linked to ${challenge.challenge_id}` : null, actor_user_id: req.user.id, actor_name: actorName(req.user) }, { transaction });
    if (challenge) await RecordHistory.create({ history_id: reference("HST"), challenge_id: challenge.challenge_id, action: "link", to_status: null, note: `Support request ${row.support_id} raised`, actor_user_id: req.user.id, actor_name: actorName(req.user) }, { transaction });
  });
  const ids = (await alertUsersFor(row)).filter((id) => id !== req.user.id);
  await notify(ids, `New support request ${row.support_id}`, `${row.support_category}: ${row.specific_support || row.other_support || ""}`.slice(0, 300), `/zonal/challenges/support/${row.support_id}`);
  res.status(201).json({ success: true, data: row });
});

const getSupport = respond(async (req, res) => {
  const row = await allowedSupport(req.params.id, req.user);
  const [challenge, history, documents] = await Promise.all([
    row.challenge_id ? Challenge.findByPk(row.challenge_id) : null,
    RecordHistory.findAll({ where: { support_id: row.support_id }, order: [["createdAt", "DESC"]] }),
    FormDocument.findAll({ where: { form_key: "support-requests", report_reference_id: row.support_id } }),
  ]);
  res.json({ success: true, data: { ...row.toJSON(), challenge, history, documents } });
});

const addSupportActivity = respond(async (req, res) => {
  if (!canComment(req.user)) throw fail("You do not have permission to update this request", 403);
  const row = await allowedSupport(req.params.id, req.user);
  const action = text(req.body.action, 30);
  const note = text(req.body.note, 5000);
  if (action === "comment") {
    if (!note) throw fail("Enter a comment");
    const entry = await RecordHistory.create({ history_id: reference("HST"), support_id: row.support_id, action: "comment", note, actor_user_id: req.user.id, actor_name: actorName(req.user) });
    await notify([row.submitted_by_user_id].filter((id) => id !== req.user.id), `Comment on ${row.support_id}`, note.slice(0, 300), `/zonal/challenges/support/${row.support_id}`);
    return res.status(201).json({ success: true, data: entry });
  }
  const newStatus = text(req.body.status, 40);
  if (!T.SUPPORT_STATUSES.includes(newStatus)) throw fail("Select a valid support status");
  const isOwner = row.submitted_by_user_id === req.user.id;
  if (!isOwner && !canAssign(req.user)) throw fail("Only the requesting office or SDO/HQ can change this status", 403);
  const patch = { status: newStatus };
  if (newStatus === "Assigned") {
    const dept = text(req.body.nhia_department, 80);
    if (dept && T.CHALLENGE_DEPARTMENTS.includes(dept)) patch.nhia_department = dept;
  }
  await sequelize.transaction(async (transaction) => {
    await row.update(patch, { transaction });
    await RecordHistory.create({ history_id: reference("HST"), support_id: row.support_id, action: newStatus === "Assigned" ? "assign" : "status", from_status: req.body.from_status || row.status, to_status: newStatus, note: note || null, actor_user_id: req.user.id, actor_name: actorName(req.user) }, { transaction });
  });
  await notify([row.submitted_by_user_id].filter((id) => id !== req.user.id), `${row.support_id} → ${newStatus}`, note || `Status changed to ${newStatus}`, `/zonal/challenges/support/${row.support_id}`);
  res.json({ success: true, data: row });
});

module.exports = {
  hasChallengesAccess,
  catalogue, listChallenges, createChallenge, getChallenge, updateChallenge, addChallengeActivity,
  listSupport, createSupport, getSupport, addSupportActivity,
};
