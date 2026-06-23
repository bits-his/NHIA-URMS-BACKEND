const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Standards & Quality Assurance — monthly submission
const SqaMonthlyReport = sequelize.define("SqaMonthlyReport", {
  id:           { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  state_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: "state_offices", key: "id" } },
  reporting_year:  { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  // HCF counts
  total_hcf_under_nhia:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  total_accredited_hcf:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // CEmONC
  cemonc_accredited_hcf:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  cemonc_beneficiaries:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // FFP
  ffp_accredited_facilities:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  ffp_beneficiaries:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Quality Assurance
  qa_conducted:               { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Accreditation
  accreditation_requests:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  accreditation_conducted:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Mystery Shopping
  mystery_shopping_visited:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  mystery_shopping_complied:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  mystery_shopping_non_complied: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Complaints
  complaints_registered:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  complaints_resolved:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  complaints_escalated:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Meta
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  section: { type: DataTypes.ENUM("sqa","complaints"), allowNull: false, defaultValue: "sqa", comment: "sqa=HMO/HCP QA, complaints=Enrollee Complaints" },
  status: { type: DataTypes.ENUM("draft","submitted","under_review","zonal_review","approved","rejected"), allowNull: false, defaultValue: "draft" },
  // Approval chain audit
  state_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
  state_reviewed_at: { type: DataTypes.DATE,        allowNull: true },
  state_review_note: { type: DataTypes.TEXT,        allowNull: true },
  zonal_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
  zonal_reviewed_at: { type: DataTypes.DATE,        allowNull: true },
  zonal_review_note: { type: DataTypes.TEXT,        allowNull: true },
  rejection_reason:  { type: DataTypes.TEXT,        allowNull: true },
  rejected_by:       { type: DataTypes.STRING(100), allowNull: true },
  rejected_at:       { type: DataTypes.DATE,        allowNull: true },
}, { tableName: "sqa_monthly_reports", modelName: "SqaMonthlyReport" });

module.exports = SqaMonthlyReport;
