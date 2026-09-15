const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PrepaymentAnalysis = sequelize.define("PrepaymentAnalysis", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  controlNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  entryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  procurementInstrument: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contractorName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contractorAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  refInvoiceDeliveryNote: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  itemDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  quantityOrdered: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  quantitySupplied: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rate: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  awardLetterPath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  awardLetterName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  zone_id: { type: DataTypes.INTEGER, allowNull: true },
  state_id: { type: DataTypes.INTEGER, allowNull: true },
  zone_name: { type: DataTypes.STRING, allowNull: true },
  state_name: { type: DataTypes.STRING, allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "prepayment_analyses",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = PrepaymentAnalysis;
