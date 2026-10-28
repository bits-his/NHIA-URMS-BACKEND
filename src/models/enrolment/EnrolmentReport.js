const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Enrolment Activity Reporting — one row per activity.
 * PK reference_id (no auto-increment id, no separate lines table).
 */
const EnrolmentReport = sequelize.define(
  "EnrolmentReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    department_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "departments", key: "department_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "units", key: "unit_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
    coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },

    category: { type: DataTypes.STRING(100), allowNull: false },
    activity_code: { type: DataTypes.STRING(20), allowNull: true },
    activity_date: { type: DataTypes.DATEONLY, allowNull: true },
    enrolment_channel: { type: DataTypes.STRING(50), allowNull: true },
    enrolment_type: { type: DataTypes.STRING(40), allowNull: true },
    program_code: { type: DataTypes.STRING(20), allowNull: true },
    program_name: { type: DataTypes.STRING(100), allowNull: true },
    enrolment_category: { type: DataTypes.STRING(100), allowNull: true },
    beneficiary_category: { type: DataTypes.STRING(80), allowNull: true },
    beneficiary_status: { type: DataTypes.STRING(80), allowNull: true },
    funding_option: { type: DataTypes.STRING(80), allowNull: true },
    supporting_evidence: { type: DataTypes.STRING(120), allowNull: true },
    status_reason: { type: DataTypes.TEXT, allowNull: true },
    activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    enrolment_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    enrollees_validated: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    activity_status: { type: DataTypes.STRING(40), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    program_details: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const raw = this.getDataValue("program_details");
        if (!raw) return null;
        if (typeof raw === "object") return raw;
        if (typeof raw === "string") {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return null;
      },
    },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },

    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "enrolment_reports",
    modelName: "EnrolmentReport",
    indexes: [
      {
        fields: ["zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_enrolment_reports_state_period",
      },
      { fields: ["category"] },
      { fields: ["activity_date"] },
    ],
  },
);

module.exports = EnrolmentReport;
