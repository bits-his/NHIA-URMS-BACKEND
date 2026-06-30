const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const CemoncReport = require("./CemoncReport");

const CemoncReportLine = sequelize.define("CemoncReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "cemonc_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  intervention_type: {
    type: DataTypes.ENUM("cemonc", "ffp"),
    allowNull: false,
  },
  facility_name: { type: DataTypes.STRING(255), allowNull: false },
  beneficiaries: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "cemonc_report_lines", modelName: "CemoncReportLine" });

CemoncReport.hasMany(CemoncReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
CemoncReportLine.belongsTo(CemoncReport, { foreignKey: "report_id", as: "report" });

module.exports = CemoncReportLine;
