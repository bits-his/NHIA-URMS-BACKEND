const { DataTypes: D } = require("sequelize");
const sequelize = require("../config/database");

const pk = () => ({ type: D.STRING(30), primaryKey: true, allowNull: false });
const geo = () => ({
  state_code: { type: D.STRING(20), allowNull: false, references: { model: "state_offices", key: "code" } },
  zonal_code: { type: D.STRING(20), allowNull: false, references: { model: "zonal_offices", key: "zonal_code" } },
});
const userRef = (allowNull = false) => ({ type: D.INTEGER.UNSIGNED, allowNull, references: { model: "users", key: "id" } });
const define = (name, tableName, fields, indexes = []) =>
  sequelize.define(name, fields, { tableName, indexes, charset: "utf8mb4", collate: "utf8mb4_general_ci" });

const Challenge = define("Challenge", "challenges", {
  challenge_id: pk(), ...geo(),
  date_reported: { type: D.DATEONLY, allowNull: false },
  related_activity: { type: D.STRING(120), allowNull: true },
  programme: { type: D.STRING(80), allowNull: true },
  category_key: { type: D.STRING(60), allowNull: false },
  category_label: { type: D.STRING(100), allowNull: false },
  specific_challenge: { type: D.STRING(200), allowNull: true },
  other_challenge: { type: D.STRING(255), allowNull: true },
  severity: { type: D.STRING(20), allowNull: true },
  impact: { type: D.STRING(120), allowNull: true },
  status: { type: D.STRING(40), allowNull: false, defaultValue: "In-progress" },
  escalation_department: { type: D.STRING(80), allowNull: true },
  description: { type: D.TEXT, allowNull: true },
  key_recommendation: { type: D.TEXT, allowNull: true },
  support_context: { type: D.TEXT, allowNull: true },
  remarks: { type: D.TEXT, allowNull: true },
  legacy_line_id: { type: D.INTEGER.UNSIGNED, allowNull: true },
  created_by_user_id: userRef(true),
  created_by_name: { type: D.STRING(150), allowNull: false },
}, [
  { name: "idx_challenges_state", fields: ["state_code"] },
  { name: "idx_challenges_zonal", fields: ["zonal_code"] },
  { name: "idx_challenges_status", fields: ["status"] },
  { name: "idx_challenges_category", fields: ["category_key"] },
  { name: "uq_challenges_legacy_line", unique: true, fields: ["legacy_line_id"] },
]);

const SupportRequest = define("SupportRequest", "support_requests", {
  support_id: pk(), ...geo(),
  challenge_id: { type: D.STRING(30), allowNull: true, references: { model: "challenges", key: "challenge_id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
  date_submitted: { type: D.DATEONLY, allowNull: false },
  action_required_from: { type: D.STRING(60), allowNull: false },
  other_action_owner: { type: D.STRING(255), allowNull: true },
  nhia_department: { type: D.STRING(80), allowNull: true },
  support_category: { type: D.STRING(120), allowNull: false },
  specific_support: { type: D.STRING(200), allowNull: true },
  other_support: { type: D.STRING(255), allowNull: true },
  priority: { type: D.STRING(20), allowNull: true },
  description: { type: D.TEXT, allowNull: true },
  operational_impact: { type: D.STRING(200), allowNull: true },
  required_by_date: { type: D.DATEONLY, allowNull: true },
  status: { type: D.STRING(40), allowNull: false, defaultValue: "Submitted" },
  submitted_by_user_id: userRef(true),
  submitted_by_name: { type: D.STRING(150), allowNull: false },
}, [
  { name: "idx_support_state", fields: ["state_code"] },
  { name: "idx_support_zonal", fields: ["zonal_code"] },
  { name: "idx_support_challenge", fields: ["challenge_id"] },
  { name: "idx_support_status", fields: ["status"] },
  { name: "idx_support_required_by", fields: ["required_by_date"] },
]);

/** Audit trail + comments for both record kinds. Exactly one parent FK must be set. */
const RecordHistory = define("ChallengeSupportHistory", "challenge_support_history", {
  history_id: pk(),
  challenge_id: { type: D.STRING(30), allowNull: true, references: { model: "challenges", key: "challenge_id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
  support_id: { type: D.STRING(30), allowNull: true, references: { model: "support_requests", key: "support_id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
  action: { type: D.STRING(30), allowNull: false }, // create | status | assign | link | comment
  from_status: { type: D.STRING(40), allowNull: true },
  to_status: { type: D.STRING(40), allowNull: true },
  note: { type: D.TEXT, allowNull: true },
  actor_user_id: userRef(true),
  actor_name: { type: D.STRING(150), allowNull: false },
}, [
  { name: "idx_history_challenge", fields: ["challenge_id"] },
  { name: "idx_history_support", fields: ["support_id"] },
]);

Challenge.hasMany(SupportRequest, { foreignKey: "challenge_id", as: "support_requests" });
SupportRequest.belongsTo(Challenge, { foreignKey: "challenge_id", as: "challenge" });
Challenge.hasMany(RecordHistory, { foreignKey: "challenge_id", as: "history" });
RecordHistory.belongsTo(Challenge, { foreignKey: "challenge_id", as: "challenge" });
SupportRequest.hasMany(RecordHistory, { foreignKey: "support_id", as: "history" });
RecordHistory.belongsTo(SupportRequest, { foreignKey: "support_id", as: "support" });

module.exports = { Challenge, SupportRequest, RecordHistory };
