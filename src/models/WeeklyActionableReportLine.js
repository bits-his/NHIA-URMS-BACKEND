const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const WeeklyActionableReport = require("./WeeklyActionableReport");

const WeeklyActionableReportLine = sequelize.define("WeeklyActionableReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "weekly_actionable_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  issue_request:   { type: DataTypes.TEXT,         allowNull: false },
  category: {
    type: DataTypes.ENUM("operational", "budgetary", "administrative", "policy"),
    allowNull: false,
  },
  impact: {
    type: DataTypes.ENUM("high", "medium", "low"),
    allowNull: false,
  },
  urgency: {
    type: DataTypes.ENUM("high", "medium", "low"),
    allowNull: false,
  },
  user_department: { type: DataTypes.STRING(100), allowNull: false },
  priority_level:  { type: DataTypes.STRING(60),  allowNull: true },
  status: {
    type: DataTypes.ENUM("escalated", "awaiting_further_info", "awaiting_response", "resolved"),
    allowNull: false,
  },
}, { tableName: "weekly_actionable_report_lines", modelName: "WeeklyActionableReportLine" });

WeeklyActionableReport.hasMany(WeeklyActionableReportLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
WeeklyActionableReportLine.belongsTo(WeeklyActionableReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = WeeklyActionableReportLine;
