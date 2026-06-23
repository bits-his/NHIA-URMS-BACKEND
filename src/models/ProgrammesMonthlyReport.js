const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Programmes Department — monthly submission
const ProgrammesMonthlyReport = sequelize.define("ProgrammesMonthlyReport", {
  id:           { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  state_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: "state_offices", key: "id" } },
  reporting_year:  { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  // GIFSHIP
  gifship_enrolments:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  gifship_premium:       { type: DataTypes.DECIMAL(14,2),    allowNull: true, defaultValue: 0 },
  // OPS
  ops_count:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // FSSHIP
  fsship_new_enrolments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Extra Dependants
  extra_dependants:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  extra_dependant_premium:  { type: DataTypes.DECIMAL(14,2),    allowNull: true, defaultValue: 0 },
  // Additional Dependants
  additional_dependants: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Change of Provider
  change_of_provider:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Schemes
  bhcpf_beneficiaries:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  bhcpf_facilities:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  tiship_lives:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  participating_institutions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  mha_lives:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  sshia_lives:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Outreach
  stakeholder_meetings:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  media_appearances:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  marketing_sensitization: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Meta
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  section: { type: DataTypes.ENUM("enrolment","outreach"), allowNull: false, defaultValue: "enrolment", comment: "enrolment=Enrolment section, outreach=Outreach section" },
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
}, { tableName: "programmes_monthly_reports", modelName: "ProgrammesMonthlyReport" });

module.exports = ProgrammesMonthlyReport;
