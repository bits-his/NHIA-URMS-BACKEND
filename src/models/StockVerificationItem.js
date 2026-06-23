const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const StockVerification = require("./StockVerification");
const StockAsset = require("./StockAsset");

/**
 * One row in the verification table per asset.
 * Variance = book_balance - physical_count (computed on save).
 */
const StockVerificationItem = sequelize.define(
  "StockVerificationItem",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    verification_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
      references: { model: "stock_verifications", key: "id" },
      onDelete: "CASCADE", onUpdate: "CASCADE",
    },
    asset_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: true,
      references: { model: "stock_assets", key: "id" },
      onDelete: "SET NULL", onUpdate: "CASCADE",
    },
    // Snapshot fields (copied from asset at time of verification)
    item_class:       { type: DataTypes.STRING(100), allowNull: false },
    item_description: { type: DataTypes.STRING(255), allowNull: false },
    asset_tag:        { type: DataTypes.STRING(100), allowNull: true },
    book_balance:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    physical_count:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    variance:         { type: DataTypes.INTEGER,          allowNull: false, defaultValue: 0 },
    condition:        { type: DataTypes.ENUM("good", "bad"), allowNull: false, defaultValue: "good" },
    remarks:          { type: DataTypes.STRING(255), allowNull: true },
  },
  { tableName: "stock_verification_items", modelName: "StockVerificationItem" }
);

// ── Associations ──────────────────────────────────────────────────────────────

StockVerification.hasMany(StockVerificationItem, {
  foreignKey: "verification_id", as: "items", onDelete: "CASCADE",
});
StockVerificationItem.belongsTo(StockVerification, {
  foreignKey: "verification_id", as: "verification",
});

StockAsset.hasMany(StockVerificationItem, {
  foreignKey: "asset_id", as: "verification_items",
});
StockVerificationItem.belongsTo(StockAsset, {
  foreignKey: "asset_id", as: "asset",
});

module.exports = StockVerificationItem;
