const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Expenditure Profile — one flat row per office / quarter.
 * Fixed 9 expense categories as columns (no lines table).
 * Allocation % lives in application config, not in the DB row.
 */
const money = () => ({ type: DataTypes.DECIMAL(18, 2), allowNull: true });

const FinanceExpenditureProfile = sequelize.define(
  "FinanceExpenditureProfile",
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
      type: DataTypes.ENUM("draft", "awaiting_review", "returned", "endorsed", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
    coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },

    fuel_lubricants: money(),
    newspapers_periodicals: money(),
    entertainment_hospitality: money(),
    telephone_postages: money(),
    printing_stationery: money(),
    transport_travel: money(),
    maintenance_vehicles: money(),
    maintenance_equipment: money(),
    utilities_bank_charges: money(),

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
    tableName: "finance_expenditure_profiles",
    modelName: "FinanceExpenditureProfile",
    indexes: [
      {
        unique: true,
        fields: ["zonal_code", "state_code", "reporting_year", "reporting_quarter"],
        name: "uq_finance_exp_office_period",
      },
      { fields: ["status"], name: "idx_finance_exp_status" },
    ],
  },
);

module.exports = FinanceExpenditureProfile;
