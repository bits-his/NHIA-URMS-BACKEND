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
    type: DataTypes.ENUM(
      "mop_up", "gifship", "tiship", "extra_dependant",
      "additional_dependant", "ops", "sshia"
    ),
    allowNull: false,
  },
  enrolment_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
}, { tableName: "enrolment_report_lines", modelName: "EnrolmentReportLine" });

EnrolmentReport.hasMany(EnrolmentReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
EnrolmentReportLine.belongsTo(EnrolmentReport, { foreignKey: "report_id", as: "report" });

module.exports = EnrolmentReportLine;
