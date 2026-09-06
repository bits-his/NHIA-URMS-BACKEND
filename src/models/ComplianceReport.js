const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ComplianceReport = sequelize.define("ComplianceReport", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  zone_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "zonal_offices", key: "id" },
  },
  state_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_offices", key: "id" },
  },
  reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_week: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, comment: "ISO week number" },
  reporting_quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
  officer_name: { type: DataTypes.STRING(150), allowNull: true },
  officer_staff_id: { type: DataTypes.STRING(50), allowNull: true },
  date_submitted: { type: DataTypes.DATEONLY, allowNull: true },
  reviewed_by: { type: DataTypes.STRING(150), allowNull: true },
  compliance_status_confirmed: {
    type: DataTypes.ENUM("yes", "no", "pending"),
    allowNull: false,
    defaultValue: "pending",
  },
  follow_up_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  certification: { type: DataTypes.TEXT, allowNull: true },
  facility_name: { type: DataTypes.STRING(200), allowNull: true },
  facility_code: { type: DataTypes.STRING(30), allowNull: true },
  facility_type: { type: DataTypes.STRING(50), allowNull: true },
  ownership: { type: DataTypes.STRING(50), allowNull: true },
  facility_address: { type: DataTypes.TEXT, allowNull: true },
  complaints_received: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  complaint_categories: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  resolved_at_facility: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  escalated_to: {
    type: DataTypes.ENUM(
      "none",
      "state_office",
      "zonal_office",
      "enforcement_department"
    ),
    allowNull: false,
    defaultValue: "none",
  },
  complaint_summary: { type: DataTypes.TEXT, allowNull: true },
  state_office_remarks: { type: DataTypes.TEXT, allowNull: true },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false,
    defaultValue: "draft",
  },
}, { tableName: "compliance_reports", modelName: "ComplianceReport" });

module.exports = ComplianceReport;
