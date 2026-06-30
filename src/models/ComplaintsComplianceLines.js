const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ComplaintsComplianceReport = require("./ComplaintsComplianceReport");

const ComplaintSummaryLine = sequelize.define("ComplaintSummaryLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "complaints_compliance_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  category: {
    type: DataTypes.ENUM("against_hmo", "against_hcp"),
    allowNull: false,
  },
  complaint_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "complaint_summary_lines", modelName: "ComplaintSummaryLine" });

const ComplaintStatusLine = sequelize.define("ComplaintStatusLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "complaints_compliance_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  status: {
    type: DataTypes.ENUM("resolved", "unresolved", "pending", "escalated"),
    allowNull: false,
  },
  status_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "complaint_status_lines", modelName: "ComplaintStatusLine" });

const ComplianceVisitLine = sequelize.define("ComplianceVisitLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "complaints_compliance_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  facility_visited: { type: DataTypes.STRING(255), allowNull: false },
  visit_date: { type: DataTypes.DATEONLY, allowNull: true },
  purpose: { type: DataTypes.STRING(500), allowNull: true },
  outcome: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: "compliance_visit_lines", modelName: "ComplianceVisitLine" });

const ReconciliationLine = sequelize.define("ReconciliationLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "complaints_compliance_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  hmo: { type: DataTypes.STRING(255), allowNull: false },
  facility: { type: DataTypes.STRING(255), allowNull: false },
  amount_owed: { type: DataTypes.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
  recon_status: { type: DataTypes.STRING(100), allowNull: true },
  comment: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: "reconciliation_lines", modelName: "ReconciliationLine" });

ComplaintsComplianceReport.hasMany(ComplaintSummaryLine, { foreignKey: "report_id", as: "summary_lines", onDelete: "CASCADE" });
ComplaintSummaryLine.belongsTo(ComplaintsComplianceReport, { foreignKey: "report_id", as: "report" });

ComplaintsComplianceReport.hasMany(ComplaintStatusLine, { foreignKey: "report_id", as: "status_lines", onDelete: "CASCADE" });
ComplaintStatusLine.belongsTo(ComplaintsComplianceReport, { foreignKey: "report_id", as: "report" });

ComplaintsComplianceReport.hasMany(ComplianceVisitLine, { foreignKey: "report_id", as: "visit_lines", onDelete: "CASCADE" });
ComplianceVisitLine.belongsTo(ComplaintsComplianceReport, { foreignKey: "report_id", as: "report" });

ComplaintsComplianceReport.hasMany(ReconciliationLine, { foreignKey: "report_id", as: "reconciliation_lines", onDelete: "CASCADE" });
ReconciliationLine.belongsTo(ComplaintsComplianceReport, { foreignKey: "report_id", as: "report" });

module.exports = {
  ComplaintSummaryLine, ComplaintStatusLine, ComplianceVisitLine, ReconciliationLine,
};
