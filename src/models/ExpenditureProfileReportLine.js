const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ExpenditureProfileReport = require("./ExpenditureProfileReport");

const ExpenditureProfileReportLine = sequelize.define("ExpenditureProfileReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "expenditure_profile_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  sub_head: {
    type: DataTypes.ENUM(
      "fuel_lub", "newspapers_periodicals", "ent_hosp", "tel_postages",
      "printing_stationery", "transport_travel", "maint_veh", "maint_equip",
      "utilities", "bank_charges"
    ),
    allowNull: false,
  },
  amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
}, { tableName: "expenditure_profile_report_lines", modelName: "ExpenditureProfileReportLine" });

ExpenditureProfileReport.hasMany(ExpenditureProfileReportLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
ExpenditureProfileReportLine.belongsTo(ExpenditureProfileReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = ExpenditureProfileReportLine;
