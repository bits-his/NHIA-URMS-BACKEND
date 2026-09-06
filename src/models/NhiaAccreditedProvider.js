const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NhiaAccreditedProvider = sequelize.define("NhiaAccreditedProvider", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  provider_type: {
    type: DataTypes.ENUM("hmo", "hcp"),
    allowNull: false,
  },
  provider_code: { type: DataTypes.STRING(100), allowNull: false },
  name: { type: DataTypes.STRING(500), allowNull: false },
  address: { type: DataTypes.STRING(500), allowNull: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  website: { type: DataTypes.STRING(500), allowNull: true },
  phone: { type: DataTypes.STRING(100), allowNull: true },
  facility_type: { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: "nhia_accredited_providers",
  modelName: "NhiaAccreditedProvider",
  indexes: [
    { unique: true, fields: ["provider_type", "provider_code"] },
    { fields: ["provider_type", "name"] },
  ],
});

module.exports = NhiaAccreditedProvider;
