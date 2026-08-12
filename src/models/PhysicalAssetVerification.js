const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PhysicalAssetVerification = sequelize.define("PhysicalAssetVerification", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  referenceNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  stocktakingType: {
    type: DataTypes.ENUM("annual", "monthly", "periodic", "surprise"),
    allowNull: false,
    defaultValue: "periodic",
  },
  verificationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  zone_id: { type: DataTypes.INTEGER, allowNull: true },
  state_id: { type: DataTypes.INTEGER, allowNull: true },
  department_id: { type: DataTypes.INTEGER, allowNull: true },
  unit_id: { type: DataTypes.INTEGER, allowNull: true },
  zone_name: { type: DataTypes.STRING, allowNull: true },
  state_name: { type: DataTypes.STRING, allowNull: true },
  department_name: { type: DataTypes.STRING, allowNull: true },
  unit_name: { type: DataTypes.STRING, allowNull: true },
  storeKeeper: { type: DataTypes.STRING, allowNull: true },
  auditOfficer: { type: DataTypes.STRING, allowNull: true },
  status: {
    type: DataTypes.ENUM("DRAFT", "SUBMITTED", "APPROVED"),
    allowNull: false,
    defaultValue: "DRAFT",
  },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: "physical_asset_verifications",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = PhysicalAssetVerification;
