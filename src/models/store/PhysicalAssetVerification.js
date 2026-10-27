const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** Physical Asset Verification session — PK reference_no (no auto-increment id). */
const PhysicalAssetVerification = sequelize.define(
  "PhysicalAssetVerification",
  {
    reference_no: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
    },
    stocktaking_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "periodic",
    },
    verification_date: { type: DataTypes.DATEONLY, allowNull: false },
    store_keeper: { type: DataTypes.STRING(150), allowNull: true },
    audit_officer: { type: DataTypes.STRING(150), allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "DRAFT",
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
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
    tableName: "physical_asset_verifications",
    modelName: "PhysicalAssetVerification",
    indexes: [
      { fields: ["verification_date"] },
      { fields: ["status"] },
      { fields: ["zonal_code", "state_code"] },
    ],
  },
);

module.exports = PhysicalAssetVerification;
