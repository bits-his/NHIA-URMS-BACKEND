const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StoreInventoryItem = sequelize.define("StoreInventoryItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  itemCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Office Consumables",
  },
  unitOfMeasure: {
    type: DataTypes.STRING,
    defaultValue: "Units",
  },
  quantityInStock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  reorderLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.0,
  },
  storeLocation: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "Main Depot",
  },
  status: {
    type: DataTypes.ENUM("IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"),
    defaultValue: "IN_STOCK",
  },
}, {
  tableName: "store_inventory_items",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = StoreInventoryItem;
