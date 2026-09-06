const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AssetMaintenance = sequelize.define("AssetMaintenance", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  maintenanceNo: {
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
  type: {
    type: DataTypes.ENUM("PREVENTIVE", "CORRECTIVE", "OVERHAUL"),
    defaultValue: "PREVENTIVE",
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  vendor: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.0,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
  completionDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  performedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: "asset_maintenances",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = AssetMaintenance;
