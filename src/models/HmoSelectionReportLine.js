const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const HmoSelectionReport = require("./HmoSelectionReport");

const HmoSelectionReportLine = sequelize.define("HmoSelectionReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "hmo_selection_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  mda: { type: DataTypes.STRING(255), allowNull: false },
  selection_date: { type: DataTypes.DATEONLY, allowNull: true },
  hmos_in_attendance: { type: DataTypes.STRING(500), allowNull: true },
  former_hmo: { type: DataTypes.STRING(255), allowNull: true },
  reason_for_change: { type: DataTypes.TEXT, allowNull: true },
  hmos_invited: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  hmos_attended: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  compliance_guideline: { type: DataTypes.STRING(10), allowNull: true },
  transparent_process: { type: DataTypes.STRING(10), allowNull: true },
  selected_hmo: { type: DataTypes.STRING(255), allowNull: true },
  evidence_path: { type: DataTypes.STRING(255), allowNull: true },
  evidence_name: { type: DataTypes.STRING(255), allowNull: true },
  report_path: { type: DataTypes.STRING(255), allowNull: true },
  report_name: { type: DataTypes.STRING(255), allowNull: true },
}, { tableName: "hmo_selection_report_lines", modelName: "HmoSelectionReportLine" });

HmoSelectionReport.hasMany(HmoSelectionReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
HmoSelectionReportLine.belongsTo(HmoSelectionReport, { foreignKey: "report_id", as: "report" });

module.exports = HmoSelectionReportLine;
