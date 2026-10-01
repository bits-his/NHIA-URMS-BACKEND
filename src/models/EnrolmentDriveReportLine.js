const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const EnrolmentDriveReport = require("./EnrolmentDriveReport");

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

const EnrolmentDriveReportLine = sequelize.define("EnrolmentDriveReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "enrolment_drive_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
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
}, { tableName: "enrolment_drive_report_lines", modelName: "EnrolmentDriveReportLine" });

EnrolmentDriveReport.hasMany(EnrolmentDriveReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
EnrolmentDriveReportLine.belongsTo(EnrolmentDriveReport, { foreignKey: "report_id", as: "report" });

module.exports = EnrolmentDriveReportLine;
