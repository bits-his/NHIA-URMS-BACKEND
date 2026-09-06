const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StockConversion = sequelize.define("StockConversion", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversionRef: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  inventoryItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  itemCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  itemName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  storeLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  assetId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assetNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  convertedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  conversionDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "stock_conversions",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = StockConversion;
