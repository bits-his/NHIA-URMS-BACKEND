const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const MigrationReport = require("./MigrationReport");

const MigrationReportLine = sequelize.define("MigrationReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "migration_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  request_type: {
    type: DataTypes.ENUM("change_of_facility", "correction_of_data", "change_of_mda"),
    allowNull: false,
  },
  request_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
}, { tableName: "migration_report_lines", modelName: "MigrationReportLine" });

MigrationReport.hasMany(MigrationReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
MigrationReportLine.belongsTo(MigrationReport, { foreignKey: "report_id", as: "report" });

module.exports = MigrationReportLine;
