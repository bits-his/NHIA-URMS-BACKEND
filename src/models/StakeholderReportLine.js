const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const StakeholderReport = require("./StakeholderReport");

const StakeholderReportLine = sequelize.define("StakeholderReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "stakeholder_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  engagement_code: { type: DataTypes.STRING(20), allowNull: true },
  activity_date: { type: DataTypes.DATEONLY, allowNull: true },
  engagement_category: { type: DataTypes.STRING(120), allowNull: false },
  stakeholder_categories: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  stakeholder_names: { type: DataTypes.TEXT, allowNull: true },
  specific_activity: { type: DataTypes.TEXT, allowNull: true },
  engagement_purpose: { type: DataTypes.TEXT, allowNull: true },
  funding_option: { type: DataTypes.STRING(80), allowNull: true },
  activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  planned_target_audience: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  target_audience_reached: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  location_category: { type: DataTypes.STRING(80), allowNull: true },
  location_name: { type: DataTypes.STRING(120), allowNull: true },
  programs_supported: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  activity_details: { type: DataTypes.TEXT, allowNull: true },
  planned_target_stakeholders: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  stakeholders_engaged: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  follow_up_required: { type: DataTypes.STRING(10), allowNull: true },
  follow_up_date: { type: DataTypes.DATEONLY, allowNull: true },
  follow_up_visits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  supporting_evidence_types: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  supporting_documents: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  outcome_category: { type: DataTypes.STRING(160), allowNull: true },
  specific_outcome: { type: DataTypes.STRING(200), allowNull: true },
  expected_output: { type: DataTypes.TEXT, allowNull: true },
  activity_status: { type: DataTypes.STRING(40), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  // legacy columns kept for older rows
  activity: { type: DataTypes.STRING(255), allowNull: true },
  audience_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  organization: { type: DataTypes.STRING(255), allowNull: true },
  location: { type: DataTypes.STRING(255), allowNull: true },
  key_outcomes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "stakeholder_report_lines", modelName: "StakeholderReportLine" });

StakeholderReport.hasMany(StakeholderReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
StakeholderReportLine.belongsTo(StakeholderReport, { foreignKey: "report_id", as: "report" });

module.exports = StakeholderReportLine;
