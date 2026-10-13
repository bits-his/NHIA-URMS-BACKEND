const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const StateOfficeHmoReconSheet = require("./StateOfficeHmoReconSheet");

/** HCF rows under a recon sheet (Templates 2A–2C) */
const StateOfficeHmoReconLine = sequelize.define("StateOfficeHmoReconLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  sheet_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_office_hmo_recon_sheets", key: "id" },
  },
  hcf_name: { type: DataTypes.STRING(255), allowNull: false },
  hcf_code: { type: DataTypes.STRING(80), allowNull: true },
  alleged_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  /** Actual indebtedness (2A/2B) or Returned Capitation (2C) */
  actual_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  agreed_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  amount_paid: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  outstanding: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  remarks: { type: DataTypes.STRING(500), allowNull: true },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "state_office_hmo_recon_lines", modelName: "StateOfficeHmoReconLine" });

StateOfficeHmoReconSheet.hasMany(StateOfficeHmoReconLine, {
  foreignKey: "sheet_id", as: "lines", onDelete: "CASCADE",
});
StateOfficeHmoReconLine.belongsTo(StateOfficeHmoReconSheet, {
  foreignKey: "sheet_id", as: "sheet",
});

module.exports = StateOfficeHmoReconLine;
