const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ChallengesReport = require("./ChallengesReport");

const ChallengesReportLine = sequelize.define("ChallengesReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "challenges_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  challenge_code: { type: DataTypes.STRING(20), allowNull: true },
  challenge_category: { type: DataTypes.STRING(80), allowNull: false },
  specific_challenge: { type: DataTypes.STRING(200), allowNull: true },
  challenge_details: { type: DataTypes.TEXT, allowNull: true },
  related_activity: { type: DataTypes.STRING(120), allowNull: true },
  related_program: { type: DataTypes.STRING(80), allowNull: true },
  severity: { type: DataTypes.STRING(40), allowNull: true },
  impact: { type: DataTypes.STRING(120), allowNull: true },
  support_required: { type: DataTypes.STRING(160), allowNull: true },
  support_context: { type: DataTypes.TEXT, allowNull: true },
  key_recommendation: { type: DataTypes.TEXT, allowNull: true },
  responsible_department: { type: DataTypes.STRING(80), allowNull: true },
  status: { type: DataTypes.STRING(60), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "challenges_report_lines", modelName: "ChallengesReportLine" });

ChallengesReport.hasMany(ChallengesReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
ChallengesReportLine.belongsTo(ChallengesReport, { foreignKey: "report_id", as: "report" });

module.exports = ChallengesReportLine;
