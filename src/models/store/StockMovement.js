const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Stock IN/OUT ledger — covers Prepayment (IN) and Issuance (OUT).
 * PK movement_code (no auto-increment id).
 */
const StockMovement = sequelize.define(
  "StockMovement",
  {
    movement_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
    },
    item_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      references: { model: "store_inventory_items", key: "item_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    direction: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: { isIn: [["IN", "OUT"]] },
    },
    movement_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["PREPAYMENT", "ISSUE", "ADJUSTMENT"]] },
    },
    qty: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    movement_date: { type: DataTypes.DATEONLY, allowNull: false },
    reference_doc: { type: DataTypes.STRING(80), allowNull: true },
    supplier_or_contractor: { type: DataTypes.STRING(200), allowNull: true },
    recipient_name: { type: DataTypes.STRING(200), allowNull: true },
    receiving_department_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "departments", key: "department_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    unit_price: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "POSTED",
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
    tableName: "stock_movements",
    modelName: "StockMovement",
    indexes: [
      { fields: ["item_code", "movement_date"] },
      { fields: ["movement_type", "direction"] },
      { fields: ["zonal_code", "state_code"] },
    ],
  },
);

module.exports = StockMovement;
