const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** Stock catalog — PK item_code (no auto-increment id). */
const StoreInventoryItem = sequelize.define(
  "StoreInventoryItem",
  {
    item_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(200), allowNull: false },
    category: { type: DataTypes.STRING(80), allowNull: true },
    uom: { type: DataTypes.STRING(40), allowNull: true, defaultValue: "Unit" },
    quantity_on_hand: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    reorder_level: { type: DataTypes.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
    unit_price: { type: DataTypes.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
    store_location: { type: DataTypes.STRING(120), allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "store_inventory_items",
    modelName: "StoreInventoryItem",
    indexes: [{ fields: ["name"] }, { fields: ["zonal_code", "state_code"] }],
  },
);

module.exports = StoreInventoryItem;
