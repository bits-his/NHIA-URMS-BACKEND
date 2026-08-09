const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AssetDisposal = sequelize.define("AssetDisposal", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  disposalNumber: {
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
  reason: {
    type: DataTypes.ENUM("OBSOLETE", "DAMAGED", "LOST", "AUCTIONED", "DONATED"),
    defaultValue: "OBSOLETE",
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  disposalValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.0,
  },
  disposalDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "asset_disposals",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = AssetDisposal;
