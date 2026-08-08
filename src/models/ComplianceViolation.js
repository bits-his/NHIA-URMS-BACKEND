const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ComplianceReport = require("./ComplianceReport");

const ComplianceViolation = sequelize.define("ComplianceViolation", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "compliance_reports", key: "id" },
  },
  nature_of_violation: { type: DataTypes.STRING(255), allowNull: false },
  nhia_act_section: { type: DataTypes.STRING(120), allowNull: true },
  occurrences: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  action_taken: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "compliance_violations", modelName: "ComplianceViolation" });

ComplianceReport.hasMany(ComplianceViolation, { foreignKey: "report_id", as: "violations" });
ComplianceViolation.belongsTo(ComplianceReport, { foreignKey: "report_id", as: "report" });

module.exports = ComplianceViolation;
