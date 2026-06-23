const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Finance & Admin Department — monthly submission
const FinanceMonthlyReport = sequelize.define("FinanceMonthlyReport", {
  id:           { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  state_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: "state_offices", key: "id" } },
  reporting_year:  { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, comment: "1-12" },
  // Staff & Fleet
  staff_no:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  total_vehicles:{ type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  // Budget
  approved_budget:       { type: DataTypes.DECIMAL(18,2), allowNull: true },
  total_amount_utilized: { type: DataTypes.DECIMAL(18,2), allowNull: true },
  // IGR
  igr_amount: { type: DataTypes.DECIMAL(18,2), allowNull: true, defaultValue: 0 },
  // Reconciliation
  total_indebtedness:    { type: DataTypes.DECIMAL(18,2), allowNull: true, defaultValue: 0 },
  amount_recovered:      { type: DataTypes.DECIMAL(18,2), allowNull: true, defaultValue: 0 },
  reconciliation_meetings: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  // Meta
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  section: { type: DataTypes.ENUM("finance","admin"), allowNull: false, defaultValue: "finance", comment: "finance=Finance dept, admin=Admin/HR dept" },
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
}, { tableName: "finance_monthly_reports", modelName: "FinanceMonthlyReport" });

module.exports = FinanceMonthlyReport;
