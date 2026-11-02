const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Internally Generated Revenue — one row per receipt / transaction.
 * Flat table (no lines). Fill once and submit.
 */
const FinanceIgrReport = sequelize.define(
  "FinanceIgrReport",
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
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
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

    entry_date: { type: DataTypes.DATEONLY, allowNull: false },
    service_type: { type: DataTypes.STRING(40), allowNull: false },
    principal_name: { type: DataTypes.STRING(200), allowNull: false },
    receipt_no: { type: DataTypes.STRING(80), allowNull: false },
    bill_rrr_no: { type: DataTypes.STRING(80), allowNull: true },
    nin_charge: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    payment_date: { type: DataTypes.DATEONLY, allowNull: true },
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
    tableName: "finance_igr_reports",
    modelName: "FinanceIgrReport",
    indexes: [
      {
        fields: ["zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_finance_igr_state_period",
      },
      { fields: ["service_type"], name: "idx_finance_igr_service" },
      { fields: ["receipt_no"], name: "idx_finance_igr_receipt" },
      { fields: ["status"], name: "idx_finance_igr_status" },
    ],
  },
);

module.exports = FinanceIgrReport;
