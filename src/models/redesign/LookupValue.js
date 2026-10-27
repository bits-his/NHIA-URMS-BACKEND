const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const LookupValue = sequelize.define(
  "LookupValue",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    domain_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "lookup_domains", key: "id" },
      onDelete: "CASCADE",
    },
    code: { type: DataTypes.STRING(80), allowNull: false },
    label: { type: DataTypes.STRING(200), allowNull: false },
    parent_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "lookup_values", key: "id" },
      onDelete: "SET NULL",
    },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    meta_json: { type: DataTypes.JSON, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "lookup_values",
    modelName: "LookupValue",
    indexes: [{ unique: true, fields: ["domain_id", "code"], name: "uq_lookup_code" }],
  },
);

module.exports = LookupValue;
