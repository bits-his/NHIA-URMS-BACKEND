const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

function parseJson(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Enrolment Drives Reporting — activity line.
 * Composite PK (reference_id, line_no); no surrogate id.
 */
const EnrolmentDriveActivityReportLine = sequelize.define(
  "EnrolmentDriveActivityReportLine",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "enrolment_drive_activity_reports", key: "reference_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    line_no: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    drive_code: { type: DataTypes.STRING(20), allowNull: true },
    activity_category: { type: DataTypes.STRING(150), allowNull: false },
    activity_date: { type: DataTypes.DATEONLY, allowNull: true },
    activity_status: { type: DataTypes.STRING(40), allowNull: true },
    specific_activity: { type: DataTypes.STRING(255), allowNull: true },
    funding_option: { type: DataTypes.STRING(80), allowNull: true },
    activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    target_audience: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        return parseJson(this.getDataValue("target_audience"));
      },
    },
    location_category: { type: DataTypes.STRING(100), allowNull: true },
    location_name: { type: DataTypes.STRING(150), allowNull: true },
    programs_supported: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        return parseJson(this.getDataValue("programs_supported"));
      },
    },
    activity_details: { type: DataTypes.TEXT, allowNull: true },
    planned_target_audience: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    target_audience_reached: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    leads_generated: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    new_enrolments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    supporting_documents: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        return parseJson(this.getDataValue("supporting_documents"));
      },
    },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  },
  {
    tableName: "enrolment_drive_activity_report_lines",
    modelName: "EnrolmentDriveActivityReportLine",
    charset: "utf8mb4",
    collate: "utf8mb4_general_ci",
  },
);

module.exports = EnrolmentDriveActivityReportLine;
