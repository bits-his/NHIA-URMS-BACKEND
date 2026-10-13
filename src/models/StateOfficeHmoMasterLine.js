const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const StateOfficeHmoMasterSheet = require("./StateOfficeHmoMasterSheet");

const StateOfficeHmoMasterLine = sequelize.define("StateOfficeHmoMasterLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  sheet_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_office_hmo_master_sheets", key: "id" },
  },
  hmo_name: { type: DataTypes.STRING(255), allowNull: false },
  facility_name: { type: DataTypes.STRING(255), allowNull: false },
  hcf_code: { type: DataTypes.STRING(80), allowNull: true },
  alleged_cap: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  alleged_ffs: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  alleged_phi: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  alleged_total: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  actual_cap: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  actual_ffs: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  actual_phi: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  actual_total: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  agreed_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  amount_paid: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  outstanding: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  remarks: { type: DataTypes.STRING(500), allowNull: true },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "state_office_hmo_master_lines", modelName: "StateOfficeHmoMasterLine" });

StateOfficeHmoMasterSheet.hasMany(StateOfficeHmoMasterLine, {
  foreignKey: "sheet_id", as: "lines", onDelete: "CASCADE",
});
StateOfficeHmoMasterLine.belongsTo(StateOfficeHmoMasterSheet, {
  foreignKey: "sheet_id", as: "sheet",
});

module.exports = StateOfficeHmoMasterLine;
