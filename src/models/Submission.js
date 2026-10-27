const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One header for every state-office, zonal, monthly, and SERVICOM activity form.
 * report_type picks the form. Fields that are not shared sit in header JSON.
 */
const Submission = sequelize.define("Submission", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  report_type: { type: DataTypes.STRING(64), allowNull: false },
  zone_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "zonal_offices", key: "id" },
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  },
  state_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "state_offices", key: "id" },
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  },
  reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  reporting_week: { type: DataTypes.STRING(16), allowNull: true },
  submission_date: { type: DataTypes.DATEONLY, allowNull: true },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "draft" },
  title: { type: DataTypes.STRING(255), allowNull: true },
  coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
  coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
  coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },
  header: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: "submissions",
  modelName: "Submission",
  indexes: [
    { name: "submissions_type_idx", fields: ["report_type"] },
    { name: "submissions_scope_idx", fields: ["report_type", "zone_id", "state_id", "reporting_year", "reporting_month"] },
  ],
});

module.exports = Submission;
