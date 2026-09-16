const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const StateOfficeHmoIndebtedness = require("./StateOfficeHmoIndebtedness");

const StateOfficeHmoIndebtednessLine = sequelize.define("StateOfficeHmoIndebtednessLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  sheet_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_office_hmo_indebtedness", key: "id" },
  },
  hmo_name: { type: DataTypes.STRING(255), allowNull: false },
  facility_name: { type: DataTypes.STRING(255), allowNull: false },
  hcf_code: { type: DataTypes.STRING(80), allowNull: true },
  nhia_cap: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  nhia_ffs: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  phi: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: "state_office_hmo_indebtedness_lines", modelName: "StateOfficeHmoIndebtednessLine" });

StateOfficeHmoIndebtedness.hasMany(StateOfficeHmoIndebtednessLine, {
  foreignKey: "sheet_id", as: "lines", onDelete: "CASCADE",
});
StateOfficeHmoIndebtednessLine.belongsTo(StateOfficeHmoIndebtedness, {
  foreignKey: "sheet_id", as: "sheet",
});

module.exports = StateOfficeHmoIndebtednessLine;
