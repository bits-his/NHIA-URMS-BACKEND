const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** Fixed asset register — PK asset_code (no auto-increment id). Independent of stock movements. */
const StoreAsset = sequelize.define(
  "StoreAsset",
  {
    asset_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
    },
    asset_number: { type: DataTypes.STRING(60), allowNull: true },
    nhia_tag_number: { type: DataTypes.STRING(60), allowNull: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING(80), allowNull: true },
    custodian: { type: DataTypes.STRING(150), allowNull: true },
    specific_location: { type: DataTypes.STRING(200), allowNull: true },
    physical_condition: { type: DataTypes.STRING(40), allowNull: true, defaultValue: "Good" },
    verification_status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Unverified",
    },
    last_verification_date: { type: DataTypes.DATEONLY, allowNull: true },
    acquisition_date: { type: DataTypes.DATEONLY, allowNull: true },
    acquisition_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE" },
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
    tableName: "store_assets",
    modelName: "StoreAsset",
    indexes: [
      { fields: ["nhia_tag_number"] },
      { fields: ["verification_status"] },
      { fields: ["zonal_code", "state_code"] },
    ],
  },
);

module.exports = StoreAsset;
