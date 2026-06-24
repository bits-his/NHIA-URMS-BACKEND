const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomFacility = sequelize.define("ServicomFacility", {
  id:            { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name:          { type: DataTypes.STRING(200), allowNull: false },
  facility_type: {
    type: DataTypes.ENUM("public", "private", "primary", "secondary", "tertiary"),
    allowNull: false,
    defaultValue: "public",
  },
  zone_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  state_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  lga:           { type: DataTypes.STRING(120), allowNull: true },
  address:       { type: DataTypes.STRING(255), allowNull: true },
  contact_person:{ type: DataTypes.STRING(150), allowNull: true },
  phone:         { type: DataTypes.STRING(30), allowNull: true },
  email:         { type: DataTypes.STRING(120), allowNull: true },
  is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: "servicom_facilities", modelName: "ServicomFacility" });

module.exports = ServicomFacility;
