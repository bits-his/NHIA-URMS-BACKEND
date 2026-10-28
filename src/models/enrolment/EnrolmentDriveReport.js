const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

function jsonArray(field) {
  return {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const raw = this.getDataValue(field);
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    },
  };
}

/**
 * Enrolment Drives — one row per drive activity.
 * PK reference_id (no auto-increment id, no lines table).
 */
const EnrolmentDriveReport = sequelize.define(
  "EnrolmentDriveReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    drive_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
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
    planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

    drive_code: { type: DataTypes.STRING(20), allowNull: true },
    activity_date: { type: DataTypes.DATEONLY, allowNull: true },
    activity_category: { type: DataTypes.STRING(120), allowNull: false },
    specific_activity: { type: DataTypes.STRING(255), allowNull: true },
    funding_option: { type: DataTypes.STRING(80), allowNull: true },
    activity_budget: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    approved_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    target_audience: jsonArray("target_audience"),
    location_category: { type: DataTypes.STRING(80), allowNull: true },
    location_name: { type: DataTypes.STRING(150), allowNull: true },
    programs_supported: jsonArray("programs_supported"),
    activity_details: { type: DataTypes.TEXT, allowNull: true },
    planned_target_audience: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    target_audience_reached: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    leads_generated: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    new_enrolments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    supporting_documents: jsonArray("supporting_documents"),
    activity_status: { type: DataTypes.STRING(30), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
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
    tableName: "enrolment_drive_reports",
    modelName: "EnrolmentDriveReport",
    indexes: [
      {
        fields: ["drive_type", "zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_enrolment_drive_type_period",
      },
      { fields: ["drive_type"] },
      { fields: ["activity_date"] },
    ],
  },
);

module.exports = EnrolmentDriveReport;
