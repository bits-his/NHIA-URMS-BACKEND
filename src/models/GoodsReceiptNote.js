const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GoodsReceiptNote = sequelize.define("GoodsReceiptNote", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  grnNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  poNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  receivedDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  totalItems: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  receivedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("DRAFT", "RECEIVED", "VERIFIED", "CANCELLED"),
    defaultValue: "RECEIVED",
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "goods_receipt_notes",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = GoodsReceiptNote;
