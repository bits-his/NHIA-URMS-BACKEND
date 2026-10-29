const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Enrolment Drives Reporting — header.
 * Primary key is system-generated reference_id (e.g. EDA-2026-00001). No auto-increment id.
 * drive_type discriminates the 8 drive packs (advocacy, community-sensitization, …).
 */
const EnrolmentDriveActivityReport = sequelize.define(
  "EnrolmentDriveActivityReport",
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
    drive_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    planned_activities: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
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
    tableName: "enrolment_drive_activity_reports",
    modelName: "EnrolmentDriveActivityReport",
    charset: "utf8mb4",
    collate: "utf8mb4_general_ci",
    indexes: [
      { name: "edar_state_period_idx", fields: ["state_code", "reporting_year", "reporting_month"] },
      { name: "edar_zone_period_idx", fields: ["zonal_code", "reporting_year", "reporting_month"] },
      { name: "edar_drive_type_idx", fields: ["drive_type"] },
    ],
  },
);

module.exports = EnrolmentDriveActivityReport;
