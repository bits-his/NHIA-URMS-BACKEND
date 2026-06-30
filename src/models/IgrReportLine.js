const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const IgrReport = require("./IgrReport");

const IgrReportLine = sequelize.define("IgrReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "igr_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  entry_date: { type: DataTypes.DATEONLY, allowNull: false },
  service_type: {
    type: DataTypes.ENUM(
      "enrollee_update", "application", "accreditation",
      "change_of_provider", "reaccreditation", "extra_dependant",
      "gifship", "ops"
    ),
    allowNull: false,
  },
  principal_name: { type: DataTypes.STRING(200), allowNull: false },
  receipt_no:     { type: DataTypes.STRING(80),  allowNull: false },
  bill_rrr_no:    { type: DataTypes.STRING(80),  allowNull: false },
  nin_charge:     { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  amount:         { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  quarter:        { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
}, { tableName: "igr_report_lines", modelName: "IgrReportLine" });

IgrReport.hasMany(IgrReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
IgrReportLine.belongsTo(IgrReport, { foreignKey: "report_id", as: "report" });

module.exports = IgrReportLine;
