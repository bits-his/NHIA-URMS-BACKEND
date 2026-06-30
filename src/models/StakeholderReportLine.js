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
  activity: { type: DataTypes.STRING(255), allowNull: false },
  audience_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  organization: { type: DataTypes.STRING(255), allowNull: true },
  location: { type: DataTypes.STRING(255), allowNull: true },
  activity_date: { type: DataTypes.DATEONLY, allowNull: true },
  key_outcomes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "stakeholder_report_lines", modelName: "StakeholderReportLine" });

StakeholderReport.hasMany(StakeholderReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
StakeholderReportLine.belongsTo(StakeholderReport, { foreignKey: "report_id", as: "report" });

module.exports = StakeholderReportLine;
