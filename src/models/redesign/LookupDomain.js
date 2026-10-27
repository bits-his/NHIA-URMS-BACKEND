const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const LookupDomain = sequelize.define(
  "LookupDomain",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    key_name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "lookup_domains", modelName: "LookupDomain" },
);

module.exports = LookupDomain;
