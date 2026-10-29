const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Enrolment Activity Reporting — header.
 * Primary key is system-generated reference_id (e.g. ENR-2026-00001). No auto-increment id.
 */
const EnrolmentActivityReport = sequelize.define(
  "EnrolmentActivityReport",
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
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
  },
  {
    tableName: "enrolment_activity_reports",
    modelName: "EnrolmentActivityReport",
    // Must match zonal_offices / state_offices (utf8mb4_general_ci) for FK creation
    charset: "utf8mb4",
    collate: "utf8mb4_general_ci",
    indexes: [
      { name: "ear_state_period_idx", fields: ["state_code", "reporting_year", "reporting_month"] },
      { name: "ear_zone_period_idx", fields: ["zonal_code", "reporting_year", "reporting_month"] },
    ],
  },
);

module.exports = EnrolmentActivityReport;
