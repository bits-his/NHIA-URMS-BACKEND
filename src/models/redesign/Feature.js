const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Feature = sequelize.define(
  "Feature",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    module_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "modules", key: "id" },
      onDelete: "CASCADE",
    },
    key_name: { type: DataTypes.STRING(80), allowNull: false },
    label: { type: DataTypes.STRING(150), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "features",
    modelName: "Feature",
    indexes: [{ unique: true, fields: ["module_id", "key_name"], name: "uq_features_module_key" }],
  },
);

module.exports = Feature;
