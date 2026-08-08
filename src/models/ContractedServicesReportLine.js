const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ContractedServicesReport = require("./ContractedServicesReport");

const ContractedServicesReportLine = sequelize.define("ContractedServicesReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "contracted_services_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  service: {
    type: DataTypes.ENUM("security", "cleaning", "generator"),
    allowNull: false,
  },
  month: {
    type: DataTypes.TINYINT.UNSIGNED, allowNull: false,
    comment: "Month number 1–12",
  },
  beneficiary: { type: DataTypes.STRING(200), allowNull: false, comment: "Contractor name" },
  amount:      { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
}, { tableName: "contracted_services_report_lines", modelName: "ContractedServicesReportLine" });

ContractedServicesReport.hasMany(ContractedServicesReportLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
ContractedServicesReportLine.belongsTo(ContractedServicesReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = ContractedServicesReportLine;
