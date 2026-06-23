const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One verification session (header record).
 */
const StockVerification = sequelize.define(
  "StockVerification",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reference_id: {
      type: DataTypes.STRING(30), allowNull: false, unique: true,
      comment: "e.g. SV-2025-00001",
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
      references: { model: "zonal_offices", key: "id" },
      onDelete: "RESTRICT", onUpdate: "CASCADE",
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
      references: { model: "state_offices", key: "id" },
      onDelete: "RESTRICT", onUpdate: "CASCADE",
    },
    department_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: true,
      references: { model: "departments", key: "id" },
      onDelete: "SET NULL", onUpdate: "CASCADE",
    },
    unit_id: {
      type: DataTypes.INTEGER.UNSIGNED, allowNull: true,
      references: { model: "units", key: "id" },
      onDelete: "SET NULL", onUpdate: "CASCADE",
    },
    stocktaking_type: {
      type: DataTypes.ENUM("annual", "monthly", "periodic", "surprise"),
      allowNull: false,
    },
    store_keeper:  { type: DataTypes.STRING(150), allowNull: true },
    audit_officer: { type: DataTypes.STRING(150), allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false, defaultValue: "draft",
    },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    verification_date: { type: DataTypes.DATEONLY, allowNull: true },
  },
  { tableName: "stock_verifications", modelName: "StockVerification" }
);

module.exports = StockVerification;
