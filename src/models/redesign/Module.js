const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Module = sequelize.define(
  "Module",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    key_name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "modules", modelName: "Module" },
);

module.exports = Module;
