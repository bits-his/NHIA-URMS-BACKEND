const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StoreAsset = sequelize.define("StoreAsset", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  assetNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  assetId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  controlNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "Office Equipment",
  },
  primaryCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  specificType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nhiaTagNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  serialNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  barcodeQrCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  officeDeptUnit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  coordinator: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingOfficer: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  supervisor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  facilitySite: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  specificLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  yearOfAllocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  assignedCustodian: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  custodian: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  zone_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  state_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  department_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  department_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  unit_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  unit_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  operationalStatus: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "Active (in-use)",
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "ACTIVE",
  },
  acquisitionDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  acquisitionValue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  acquisitionCost: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  usefulLifeYears: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  salvageValue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  depreciationMethod: {
    type: DataTypes.STRING,
    defaultValue: "Straight-Line",
  },
  accumulatedDepreciation: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  netBookValue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  physicalCondition: {
    type: DataTypes.STRING,
    defaultValue: "Excellent",
  },
  lastVerificationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  verificationStatus: {
    type: DataTypes.STRING,
    defaultValue: "Verified & Passed",
  },
  taggingMethod: {
    type: DataTypes.STRING,
    defaultValue: "QR Code",
  },
  categoryAttributes: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: "store_assets",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = StoreAsset;
