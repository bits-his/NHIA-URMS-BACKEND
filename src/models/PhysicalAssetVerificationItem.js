const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PhysicalAssetVerificationItem = sequelize.define("PhysicalAssetVerificationItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  verification_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  assetId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assetNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  assetName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  custodian: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bookBalance: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  physicalCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  variance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  condition: {
    type: DataTypes.ENUM("GOOD", "FAIR", "POOR", "MISSING", "DAMAGED", "DEFECTIVE", "OBSOLETE", "RETIRED"),
    defaultValue: "GOOD",
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "physical_asset_verification_items",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = PhysicalAssetVerificationItem;
