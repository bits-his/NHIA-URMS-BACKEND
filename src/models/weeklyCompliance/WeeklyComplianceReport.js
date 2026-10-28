const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Weekly Compliance — one row per facility-week (Section A + workflow).
 * PK reference_id (no auto-increment id).
 */
const WeeklyComplianceReport = sequelize.define(
  "WeeklyComplianceReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
    reporting_week: { type: DataTypes.STRING(10), allowNull: false },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    facility_id: { type: DataTypes.STRING(40), allowNull: true },
    facility_name: { type: DataTypes.STRING(255), allowNull: false },
    nhia_code: { type: DataTypes.STRING(60), allowNull: true },
    facility_type: { type: DataTypes.STRING(30), allowNull: true },
    facility_type_other: { type: DataTypes.STRING(120), allowNull: true },
    facility_address: { type: DataTypes.STRING(500), allowNull: true },
    compliance_officer: { type: DataTypes.STRING(150), allowNull: true },
    designation_staff_id: { type: DataTypes.STRING(150), allowNull: true },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "weekly_compliance_reports",
    modelName: "WeeklyComplianceReport",
    indexes: [
      {
        unique: true,
        fields: ["state_code", "reporting_week", "nhia_code"],
        name: "uq_wcr_state_week_nhia",
      },
      {
        fields: ["zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_wcr_geo_period",
      },
    ],
  },
);

module.exports = WeeklyComplianceReport;
