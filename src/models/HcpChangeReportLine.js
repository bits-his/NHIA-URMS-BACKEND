const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const HcpChangeReport = require("./HcpChangeReport");

const HcpChangeReportLine = sequelize.define("HcpChangeReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "hcp_change_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  record_date: { type: DataTypes.DATEONLY, allowNull: true },
  enrollee_name: { type: DataTypes.STRING(150), allowNull: false },
  nhia_number: { type: DataTypes.STRING(50), allowNull: false },
  current_hcp_hmo: { type: DataTypes.STRING(255), allowNull: true },
  new_hcp_hmo: { type: DataTypes.STRING(255), allowNull: true },
  reason_for_transfer: { type: DataTypes.TEXT, allowNull: true },
  met_criteria: { type: DataTypes.STRING(10), allowNull: true },
  request_channel: { type: DataTypes.STRING(30), allowNull: true },
  request_date: { type: DataTypes.DATEONLY, allowNull: true },
  process_end_date: { type: DataTypes.DATEONLY, allowNull: true },
  line_status: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "pending" },
}, { tableName: "hcp_change_report_lines", modelName: "HcpChangeReportLine" });

HcpChangeReport.hasMany(HcpChangeReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
HcpChangeReportLine.belongsTo(HcpChangeReport, { foreignKey: "report_id", as: "report" });

module.exports = HcpChangeReportLine;
