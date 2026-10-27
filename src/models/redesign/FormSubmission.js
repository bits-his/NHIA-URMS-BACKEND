const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormSubmission = sequelize.define(
  "FormSubmission",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    template_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_templates", key: "id" },
    },
    version_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_template_versions", key: "id" },
    },
    reference_id: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    legacy_report_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "enrolment_reports.id during dual-write",
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "zonal_offices", key: "id" },
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "state_offices", key: "id" },
    },
    /** YYYY-MM or YYYY-Www or YYYY-Qn — unique period per template+geo */
    period_key: { type: DataTypes.STRING(20), allowNull: false },
    period_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
    period_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    period_week: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    period_quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "draft" },
    submitted_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "form_submissions",
    modelName: "FormSubmission",
    indexes: [
      {
        unique: true,
        fields: ["template_id", "zone_id", "state_id", "period_key"],
        name: "uq_submission_period",
      },
      { fields: ["legacy_report_id"], name: "idx_submissions_legacy" },
      { fields: ["status"], name: "idx_submissions_status" },
    ],
  },
);

module.exports = FormSubmission;
