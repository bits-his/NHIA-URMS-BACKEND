const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ComplianceReport = require("./ComplianceReport");

const ComplianceFinding = sequelize.define("ComplianceFinding", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "compliance_reports", key: "id" },
  },
  section: { type: DataTypes.STRING(80), allowNull: false },
  indicator: { type: DataTypes.STRING(255), allowNull: false },
  status: {
    type: DataTypes.ENUM("fully_compliant", "partially_compliant", "non_compliant"),
    allowNull: false,
    defaultValue: "fully_compliant",
  },
  remarks: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "compliance_findings", modelName: "ComplianceFinding" });

ComplianceReport.hasMany(ComplianceFinding, { foreignKey: "report_id", as: "findings" });
ComplianceFinding.belongsTo(ComplianceReport, { foreignKey: "report_id", as: "report" });

module.exports = ComplianceFinding;
