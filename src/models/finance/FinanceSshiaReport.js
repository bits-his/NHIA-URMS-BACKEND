const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * SSHIA Progress Report — one flat row per office / quarter.
 * Fixed 4 sub-heads as columns (no lines table).
 */
const money = () => ({ type: DataTypes.DECIMAL(18, 2), allowNull: true });
const lives = () => ({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true });

const FinanceSshiaReport = sequelize.define(
  "FinanceSshiaReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    department_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "departments", key: "department_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "units", key: "unit_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    reporting_quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
    coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },

    // Capitation
    cap_opening_balance: money(),
    cap_receipts: money(),
    cap_actual_expenditure: money(),
    cap_bhcpf_lives: lives(),

    // Fee-for-Service
    ffs_opening_balance: money(),
    ffs_receipts: money(),
    ffs_actual_expenditure: money(),
    ffs_bhcpf_lives: lives(),

    // Reserve Funds
    reserve_opening_balance: money(),
    reserve_receipts: money(),
    reserve_actual_expenditure: money(),
    reserve_bhcpf_lives: lives(),

    // Admin. Charges
    admin_opening_balance: money(),
    admin_receipts: money(),
    admin_actual_expenditure: money(),
    admin_bhcpf_lives: lives(),

    remarks: { type: DataTypes.TEXT, allowNull: true },

    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "finance_sshia_reports",
    modelName: "FinanceSshiaReport",
    indexes: [
      {
        unique: true,
        fields: ["zonal_code", "state_code", "reporting_year", "reporting_quarter"],
        name: "uq_finance_sshia_office_period",
      },
      { fields: ["status"], name: "idx_finance_sshia_status" },
    ],
  },
);

module.exports = FinanceSshiaReport;
