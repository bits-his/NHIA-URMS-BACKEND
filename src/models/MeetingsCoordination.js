const { DataTypes: D } = require("sequelize");
const sequelize = require("../config/database");

const pk = () => ({ type: D.STRING(30), primaryKey: true, allowNull: false });
const geo = () => ({
  state_code: { type: D.STRING(20), allowNull: false, references: { model: "state_offices", key: "code" } },
  zonal_code: { type: D.STRING(20), allowNull: false, references: { model: "zonal_offices", key: "zonal_code" } },
});
const period = () => ({
  reporting_year: { type: D.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: D.TINYINT.UNSIGNED, allowNull: false },
});
const yn = () => ({ type: D.STRING(10), allowNull: true }); // Yes / No / Partially / N/A
const define = (name, tableName, fields, indexes = []) =>
  sequelize.define(name, fields, { tableName, indexes, charset: "utf8mb4", collate: "utf8mb4_general_ci" });

const MeetingReport = define("MeetingReport", "meeting_reports", {
  meeting_id: pk(), ...geo(), ...period(),
  meeting_date: { type: D.DATEONLY, allowNull: false },
  meeting_type: { type: D.STRING(100), allowNull: false },
  other_meeting_type: { type: D.STRING(150), allowNull: true },
  purpose: { type: D.TEXT, allowNull: true },
  presiding_officer: { type: D.STRING(150), allowNull: true },
  venue: { type: D.STRING(30), allowNull: true },
  staff_strength: { type: D.INTEGER.UNSIGNED, allowNull: true },
  attendees: { type: D.INTEGER.UNSIGNED, allowNull: true },
  attendance_rate: { type: D.DECIMAL(5, 2), allowNull: true },
  eff_prev_reviewed: yn(),
  eff_issues_discussed: yn(),
  eff_decisions_documented: yn(),
  eff_officers_assigned: yn(),
  eff_deadlines_assigned: yn(),
  eff_escalations_identified: yn(),
  eff_attendance_adequate: yn(),
  prepared_by: { type: D.STRING(150), allowNull: true },
  designation: { type: D.STRING(120), allowNull: true },
  submission_date: { type: D.DATEONLY, allowNull: true },
  endorsed_by: { type: D.STRING(150), allowNull: true },
  status: { type: D.STRING(20), allowNull: false, defaultValue: "draft" },
  created_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: true, references: { model: "users", key: "id" } },
  created_by_name: { type: D.STRING(150), allowNull: false },
}, [
  { unique: true, fields: ["state_code", "reporting_year", "reporting_month", "meeting_type"], name: "uq_meeting_state_period_type" },
  { name: "idx_meetings_zonal", fields: ["zonal_code"] },
  { name: "idx_meetings_status", fields: ["status"] },
]);

const MeetingItem = define("MeetingItem", "meeting_items", {
  item_id: pk(),
  meeting_id: { type: D.STRING(30), allowNull: false, references: { model: "meeting_reports", key: "meeting_id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
  item_kind: { type: D.ENUM("agenda", "decision", "followup"), allowNull: false },
  subject: { type: D.STRING(255), allowNull: true },       // agenda/subject or decision summary or previous action point
  detail: { type: D.TEXT, allowNull: true },               // key issue / action point / progress taken
  outcome: { type: D.TEXT, allowNull: true },              // key outcome/conclusion
  requires_action: { type: D.STRING(5), allowNull: true }, // Yes/No (agenda)
  action_ref: { type: D.STRING(40), allowNull: true },     // TAR-MMR-YYYY-MM-NNN (decision)
  responsible_officer: { type: D.STRING(150), allowNull: true },
  due_date: { type: D.DATEONLY, allowNull: true },
  expected_output: { type: D.STRING(255), allowNull: true },
  status: { type: D.STRING(40), allowNull: true },
  remarks: { type: D.TEXT, allowNull: true },
  parent_item_id: { type: D.STRING(30), allowNull: true, references: { model: "meeting_items", key: "item_id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
}, [
  { name: "idx_meeting_items_meeting", fields: ["meeting_id", "item_kind"] },
  { name: "idx_meeting_items_parent", fields: ["parent_item_id"] },
  { unique: true, fields: ["action_ref"], name: "uq_meeting_items_action_ref" },
]);

const EtmcReport = define("EtmcReport", "etmc_reports", {
  etmc_id: pk(), ...geo(), ...period(),
  etmc_meeting_date: { type: D.DATEONLY, allowNull: false },
  cascade_session_date: { type: D.DATEONLY, allowNull: true },
  etmc_session: { type: D.STRING(5), allowNull: true },    // Q1–Q4
  presiding_officer: { type: D.STRING(150), allowNull: true },
  venue: { type: D.STRING(30), allowNull: true },
  staff_strength: { type: D.INTEGER.UNSIGNED, allowNull: true },
  staff_present: { type: D.INTEGER.UNSIGNED, allowNull: true },
  attendance_rate: { type: D.DECIMAL(5, 2), allowNull: true },
  ev_attendance_list: yn(),
  ev_minutes: yn(),
  ev_presentation: yn(),
  ev_photographs: yn(),
  ev_action_tracker: yn(),
  ev_escalations_documented: yn(),
  prepared_by: { type: D.STRING(150), allowNull: true },
  designation: { type: D.STRING(120), allowNull: true },
  submission_date: { type: D.DATEONLY, allowNull: true },
  endorsed_by: { type: D.STRING(150), allowNull: true },
  status: { type: D.STRING(20), allowNull: false, defaultValue: "draft" },
  created_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: true, references: { model: "users", key: "id" } },
  created_by_name: { type: D.STRING(150), allowNull: false },
}, [
  { unique: true, fields: ["state_code", "reporting_year", "reporting_month", "etmc_session"], name: "uq_etmc_state_period_session" },
  { name: "idx_etmc_zonal", fields: ["zonal_code"] },
  { name: "idx_etmc_status", fields: ["status"] },
]);

const EtmcEntry = define("EtmcEntry", "etmc_entries", {
  entry_id: pk(),
  etmc_id: { type: D.STRING(30), allowNull: false, references: { model: "etmc_reports", key: "etmc_id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
  entry_kind: { type: D.ENUM("highlight", "department_update", "resolution", "comment", "feedback"), allowNull: false },
  subject: { type: D.STRING(255), allowNull: true },       // department/unit name etc.
  detail: { type: D.TEXT, allowNull: true },               // content
  owner_deadline: { type: D.STRING(255), allowNull: true },// resolutions only
}, [
  { name: "idx_etmc_entries_report", fields: ["etmc_id", "entry_kind"] },
]);

MeetingReport.hasMany(MeetingItem, { foreignKey: "meeting_id", as: "items" });
MeetingItem.belongsTo(MeetingReport, { foreignKey: "meeting_id", as: "meeting" });
MeetingItem.belongsTo(MeetingItem, { foreignKey: "parent_item_id", as: "parent" });
EtmcReport.hasMany(EtmcEntry, { foreignKey: "etmc_id", as: "entries" });
EtmcEntry.belongsTo(EtmcReport, { foreignKey: "etmc_id", as: "report" });

module.exports = { MeetingReport, MeetingItem, EtmcReport, EtmcEntry };
