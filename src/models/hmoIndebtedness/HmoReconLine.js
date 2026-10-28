const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** Recon facility rows — alleged → actual → agreed → paid. */
const HmoReconLine = sequelize.define(
  "HmoReconLine",
  {
    report_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "hmo_recon_reports", key: "reference_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sn: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    hcf_name: { type: DataTypes.STRING(255), allowNull: false },
    hcf_code: { type: DataTypes.STRING(80), allowNull: true },
    alleged_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    actual_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    agreed_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    amount_paid: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    outstanding: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    remarks: { type: DataTypes.STRING(500), allowNull: true },
  },
  {
    tableName: "hmo_recon_lines",
    modelName: "HmoReconLine",
  },
);

module.exports = HmoReconLine;
