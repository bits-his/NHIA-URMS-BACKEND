const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SupplyVerification = sequelize.define("SupplyVerification", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Control Number (certificate PK / display ref)
  supplyRefNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  certificateDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  goodsCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  storeSubcategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Transaction & contract
  procurementInstrument: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  procurementDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contractorAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  purchaseOrderRef: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  srvNo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  srvDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  // Legacy single-item fields (also filled from first line item)
  expectedItemName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  suppliedItemName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expectedQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  suppliedQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  // Compliance
  specificationMatch: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  priceConformance: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  physicalCondition: {
    type: DataTypes.ENUM("EXCELLENT", "GOOD", "FAIR", "POOR", "DEFECTIVE"),
    defaultValue: "GOOD",
  },
  verdict: {
    type: DataTypes.ENUM("VERIFIED_PASSED", "PARTIAL_PASS", "FAILED"),
    defaultValue: "VERIFIED_PASSED",
  },
  classification: {
    type: DataTypes.ENUM("ASSET_REGISTER", "STORE_INVENTORY"),
    defaultValue: "ASSET_REGISTER",
  },
  // Location
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  state_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  department_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  unit_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Line items [{ description, quantityDelivered, unitPrice }]
  lineItems: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  // Sign-off
  verifiedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  officerDesignation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  signOffDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  approvalStatus: {
    type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
    defaultValue: "PENDING",
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "supply_verifications",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = SupplyVerification;
