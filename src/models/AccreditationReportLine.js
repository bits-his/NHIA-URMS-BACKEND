const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const AccreditationReport = require("./AccreditationReport");

const AccreditationReportLine = sequelize.define("AccreditationReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "accreditation_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  indicator: {
    type: DataTypes.ENUM(
      "accreditation_applications", "reaccreditation_applications",
      "completed_forms_returned", "awaiting_accreditation", "awaiting_reaccreditation"
    ),
    allowNull: false,
  },
  primary_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  secondary_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "accreditation_report_lines", modelName: "AccreditationReportLine" });

AccreditationReport.hasMany(AccreditationReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
AccreditationReportLine.belongsTo(AccreditationReport, { foreignKey: "report_id", as: "report" });

module.exports = AccreditationReportLine;
