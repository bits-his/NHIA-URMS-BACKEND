const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Master asset register — one row per physical asset/item.
 * Linked to a state office and unit.
 */
const StockAsset = sequelize.define(
  "StockAsset",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
      references: { model: "state_offices", key: "id" },
      onDelete: "RESTRICT", onUpdate: "CASCADE",
    },
    unit_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: true,
      references: { model: "units", key: "id" },
      onDelete: "SET NULL", onUpdate: "CASCADE",
    },
    item_class:       { type: DataTypes.STRING(100), allowNull: false },
    item_description: { type: DataTypes.STRING(255), allowNull: false },
    asset_tag:        { type: DataTypes.STRING(100), allowNull: true },
    book_balance:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  { tableName: "stock_assets", modelName: "StockAsset" }
);

module.exports = StockAsset;
