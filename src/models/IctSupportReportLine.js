const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const IctSupportReport = require("./IctSupportReport");

const IctSupportReportLine = sequelize.define("IctSupportReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "ict_support_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  support_id: { type: DataTypes.STRING(20), allowNull: false },
  date_reported: { type: DataTypes.DATEONLY, allowNull: true },
  reported_by: { type: DataTypes.STRING(150), allowNull: true },
  support_category: { type: DataTypes.STRING(80), allowNull: true },
  issue_type: { type: DataTypes.STRING(120), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  priority: { type: DataTypes.STRING(40), allowNull: true },
  date_resolved: { type: DataTypes.DATEONLY, allowNull: true },
  resolution_status: { type: DataTypes.STRING(60), allowNull: true },
  action_taken: { type: DataTypes.TEXT, allowNull: true },
  external_support_required: { type: DataTypes.STRING(10), allowNull: true },
  referred_to: { type: DataTypes.STRING(120), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "ict_support_report_lines", modelName: "IctSupportReportLine" });

IctSupportReport.hasMany(IctSupportReportLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
IctSupportReportLine.belongsTo(IctSupportReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = IctSupportReportLine;
