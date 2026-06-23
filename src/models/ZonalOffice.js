const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ZonalOffice = sequelize.define(
  "ZonalOffice",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    zonal_code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(100), allowNull: false },
  },
  { tableName: "zonal_offices", modelName: "ZonalOffice" }
);

module.exports = ZonalOffice;
