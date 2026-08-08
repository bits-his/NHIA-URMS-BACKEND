const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ComplianceReport = require("./ComplianceReport");

const ComplianceEnforcementAction = sequelize.define("ComplianceEnforcementAction", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "compliance_reports", key: "id" },
  },
  enforcement_action: { type: DataTypes.STRING(120), allowNull: false },
  details: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "compliance_enforcement_actions", modelName: "ComplianceEnforcementAction" });

ComplianceReport.hasMany(ComplianceEnforcementAction, {
  foreignKey: "report_id", as: "enforcement_actions",
});
ComplianceEnforcementAction.belongsTo(ComplianceReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = ComplianceEnforcementAction;
