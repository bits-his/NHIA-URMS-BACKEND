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
}, { tableName: "hmo_selection_report_lines", modelName: "HmoSelectionReportLine" });

HmoSelectionReport.hasMany(HmoSelectionReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
HmoSelectionReportLine.belongsTo(HmoSelectionReport, { foreignKey: "report_id", as: "report" });

module.exports = HmoSelectionReportLine;
