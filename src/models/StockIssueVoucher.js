const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StockIssueVoucher = sequelize.define("StockIssueVoucher", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  issueNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  recipientName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  issueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  issuedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("PENDING", "APPROVED", "DISPATCHED", "REJECTED"),
    defaultValue: "PENDING",
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "stock_issue_vouchers",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = StockIssueVoucher;
