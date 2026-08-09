const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AssetTransfer = sequelize.define("AssetTransfer", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  transferNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  assetId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  assetNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  assetName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fromOffice: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  toOffice: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fromCustodian: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  toCustodian: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("DRAFT", "SUBMITTED", "APPROVED", "TRANSFERRED", "COMPLETED"),
    defaultValue: "DRAFT",
  },
  requestedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "asset_transfers",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = AssetTransfer;
