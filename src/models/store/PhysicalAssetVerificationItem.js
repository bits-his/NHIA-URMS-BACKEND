const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** PAV line — composite PK (reference_no, line_no). */
const PhysicalAssetVerificationItem = sequelize.define(
  "PhysicalAssetVerificationItem",
  {
    reference_no: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
      references: { model: "physical_asset_verifications", key: "reference_no" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    line_no: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    asset_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      references: { model: "store_assets", key: "asset_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    asset_name: { type: DataTypes.STRING(200), allowNull: true },
    category: { type: DataTypes.STRING(80), allowNull: true },
    custodian: { type: DataTypes.STRING(150), allowNull: true },
    book_balance: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 1 },
    physical_count: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    variance: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    condition: { type: DataTypes.STRING(40), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "physical_asset_verification_items",
    modelName: "PhysicalAssetVerificationItem",
    indexes: [{ fields: ["asset_code"] }],
  },
);

module.exports = PhysicalAssetVerificationItem;
