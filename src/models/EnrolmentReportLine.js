const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const EnrolmentReport = require("./EnrolmentReport");

const EnrolmentReportLine = sequelize.define("EnrolmentReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "enrolment_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  activity_code: { type: DataTypes.STRING(20), allowNull: true },
  activity_date: { type: DataTypes.DATEONLY, allowNull: true },
  enrolment_channel: { type: DataTypes.STRING(50), allowNull: true },
  program_code: { type: DataTypes.STRING(20), allowNull: true },
  program_name: { type: DataTypes.STRING(100), allowNull: true },
  enrolment_category: { type: DataTypes.STRING(100), allowNull: true },
  beneficiary_category: { type: DataTypes.STRING(80), allowNull: true },
  funding_option: { type: DataTypes.STRING(80), allowNull: true },
  activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  enrolment_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  enrollees_validated: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  activity_status: { type: DataTypes.STRING(40), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
}, { tableName: "enrolment_report_lines", modelName: "EnrolmentReportLine" });

EnrolmentReport.hasMany(EnrolmentReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
EnrolmentReportLine.belongsTo(EnrolmentReport, { foreignKey: "report_id", as: "report" });

module.exports = EnrolmentReportLine;
