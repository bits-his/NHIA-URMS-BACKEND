const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * National accredited HMO master list (from NHIA 2025 UPDATED LIST OF ACCREDITED HMOS).
 */
const HmoProvider = sequelize.define("HmoProvider", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  serial_no: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  hmo_code: { type: DataTypes.STRING(40), allowNull: false },
  hmo_code_raw: { type: DataTypes.STRING(40), allowNull: true },
  name: { type: DataTypes.STRING(500), allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: true },
  email: { type: DataTypes.STRING(500), allowNull: true },
  call_centre: { type: DataTypes.STRING(500), allowNull: true },
  source_sheet: { type: DataTypes.STRING(80), allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: "hmo_providers",
  modelName: "HmoProvider",
  indexes: [
    { unique: true, fields: ["hmo_code"] },
    { fields: ["name"] },
  ],
});

module.exports = HmoProvider;
