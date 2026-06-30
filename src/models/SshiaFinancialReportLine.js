const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const SshiaFinancialReport = require("./SshiaFinancialReport");

const SshiaFinancialReportLine = sequelize.define("SshiaFinancialReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "sshia_financial_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  sub_head: {
    type: DataTypes.ENUM(
      "capitation", "fee_for_service", "reserve_funds", "admin_charge", "operations"
    ),
    allowNull: false,
  },
  opening_balance:    { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  receipts:           { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  total_budget:       { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  actual_expenditure: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  balance:            { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  variance_pct:       { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  quarter:            { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
}, { tableName: "sshia_financial_report_lines", modelName: "SshiaFinancialReportLine" });

SshiaFinancialReport.hasMany(SshiaFinancialReportLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
SshiaFinancialReportLine.belongsTo(SshiaFinancialReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = SshiaFinancialReportLine;
