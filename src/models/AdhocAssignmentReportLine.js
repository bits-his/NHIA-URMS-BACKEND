const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const AdhocAssignmentReport = require("./AdhocAssignmentReport");

const AdhocAssignmentReportLine = sequelize.define("AdhocAssignmentReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "adhoc_assignment_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  assignment_id: { type: DataTypes.STRING(20), allowNull: false },
  date_assigned: { type: DataTypes.DATEONLY, allowNull: true },
  assignment_title: { type: DataTypes.STRING(255), allowNull: true },
  assigned_by: { type: DataTypes.STRING(150), allowNull: true },
  assignment_description: { type: DataTypes.TEXT, allowNull: true },
  expected_output: { type: DataTypes.TEXT, allowNull: true },
  responsible_unit: { type: DataTypes.STRING(150), allowNull: true },
  supporting_staff: { type: DataTypes.STRING(255), allowNull: true },
  due_date: { type: DataTypes.DATEONLY, allowNull: true },
  assignment_status: { type: DataTypes.STRING(60), allowNull: true },
  date_completed: { type: DataTypes.DATEONLY, allowNull: true },
  output_achieved: { type: DataTypes.TEXT, allowNull: true },
  challenges: { type: DataTypes.TEXT, allowNull: true },
  support_required: { type: DataTypes.STRING(150), allowNull: true },
  evidence: { type: DataTypes.STRING(500), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "adhoc_assignment_report_lines", modelName: "AdhocAssignmentReportLine" });

AdhocAssignmentReport.hasMany(AdhocAssignmentReportLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
AdhocAssignmentReportLine.belongsTo(AdhocAssignmentReport, {
  foreignKey: "report_id", as: "report",
});

module.exports = AdhocAssignmentReportLine;
