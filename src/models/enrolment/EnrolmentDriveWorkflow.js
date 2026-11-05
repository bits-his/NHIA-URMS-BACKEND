const { DataTypes: D } = require("sequelize");
const sequelize = require("../../config/database");

const pk = () => ({ type: D.STRING(30), primaryKey: true, allowNull: false });
const ref = (model, key = "reference_id", allowNull = false) => ({ type: D.STRING(30), allowNull, references: { model, key }, onDelete: "RESTRICT", onUpdate: "CASCADE" });
const geo = () => ({
  state_code: { type: D.STRING(20), allowNull: false, references: { model: "state_offices", key: "code" } },
  zonal_code: { type: D.STRING(20), allowNull: false, references: { model: "zonal_offices", key: "zonal_code" } },
});
const period = () => ({ reporting_year: { type: D.SMALLINT.UNSIGNED, allowNull: false }, reporting_month: { type: D.TINYINT.UNSIGNED, allowNull: false } });
const define = (name, tableName, fields, indexes = []) =>
  sequelize.define(name, fields, {
    tableName,
    indexes,
    charset: "utf8mb4",
    collate: "utf8mb4_general_ci",
  });

const EnrolmentDriveBatch = define("EnrolmentDriveBatch", "enrolment_drive_batches", {
  reference_id: pk(), ...geo(), ...period(),
  planned_activities: { type: D.INTEGER.UNSIGNED, allowNull: true },
  reporting_officer: { type: D.STRING(150), allowNull: false },
  created_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, references: { model: "users", key: "id" } },
  submitted_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: true },
  status: { type: D.ENUM("draft", "awaiting_review", "returned", "endorsed", "submitted"), allowNull: false, defaultValue: "draft" },
  submitted_at: { type: D.DATE, allowNull: true },
  finalised_at: { type: D.DATE, allowNull: true },
  revision: { type: D.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  reporting_deadline: { type: D.DATEONLY, allowNull: true },
}, [{ fields: ["state_code", "reporting_year", "reporting_month"], name: "idx_drive_batch_state_period" }]);

const EnrolmentDriveProgramme = define("EnrolmentDriveProgramme", "enrolment_drive_programmes", {
  drive_reference_id: { ...ref("enrolment_drive_reports"), primaryKey: true },
  programme: { type: D.STRING(100), primaryKey: true, allowNull: false },
});
const EnrolmentDriveAudience = define("EnrolmentDriveAudience", "enrolment_drive_audiences", {
  drive_reference_id: { ...ref("enrolment_drive_reports"), primaryKey: true },
  audience: { type: D.STRING(100), primaryKey: true, allowNull: false },
});
const EnrolmentDriveReview = define("EnrolmentDriveReview", "enrolment_drive_reviews", {
  reference_id: pk(), batch_reference_id: ref("enrolment_drive_batches"),
  action: { type: D.STRING(30), allowNull: false },
  from_status: { type: D.STRING(30), allowNull: false },
  to_status: { type: D.STRING(30), allowNull: false },
  revision: { type: D.INTEGER.UNSIGNED, allowNull: false },
  note: { type: D.TEXT, allowNull: true },
  actor_user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, references: { model: "users", key: "id" } },
  actor_name: { type: D.STRING(150), allowNull: false },
});
const EnrolmentDriveAction = define("EnrolmentDriveAction", "enrolment_drive_actions", {
  reference_id: pk(), ...geo(), ...period(),
  batch_reference_id: ref("enrolment_drive_batches", "reference_id", true),
  issue: { type: D.TEXT, allowNull: false },
  source_dashboard: { type: D.STRING(120), allowNull: false },
  agreed_action: { type: D.TEXT, allowNull: false },
  accountable_owner: { type: D.STRING(150), allowNull: false },
  owner_user_id: { type: D.INTEGER.UNSIGNED, allowNull: true, references: { model: "users", key: "id" } },
  deadline: { type: D.DATEONLY, allowNull: false },
  status: { type: D.ENUM("Open", "In progress", "Closed"), allowNull: false, defaultValue: "Open" },
  outcome: { type: D.TEXT, allowNull: true },
  closure_date: { type: D.DATE, allowNull: true },
  created_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: false },
  updated_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: false },
}, [{ name: "idx_drive_action_state_period_status", fields: ["state_code", "reporting_year", "reporting_month", "status"] }]);
const EnrolmentDriveEvidence = define("EnrolmentDriveEvidence", "enrolment_drive_evidence", {
  reference_id: pk(),
  drive_reference_id: ref("enrolment_drive_reports", "reference_id", true),
  action_reference_id: ref("enrolment_drive_actions", "reference_id", true),
  evidence_type: { type: D.STRING(80), allowNull: false },
  original_name: { type: D.STRING(255), allowNull: false },
  storage_key: { type: D.STRING(100), allowNull: false },
  mime_type: { type: D.STRING(120), allowNull: false },
  file_size: { type: D.INTEGER.UNSIGNED, allowNull: false },
  uploaded_by_user_id: { type: D.INTEGER.UNSIGNED, allowNull: false },
});

module.exports = { EnrolmentDriveBatch, EnrolmentDriveProgramme, EnrolmentDriveAudience, EnrolmentDriveReview, EnrolmentDriveAction, EnrolmentDriveEvidence };
