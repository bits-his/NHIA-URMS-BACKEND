const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ZonalOffice = sequelize.define(
  "ZonalOffice",
  {
    /** Business primary key — no auto-increment id */
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      primaryKey: true,
    },
    description: { type: DataTypes.STRING(100), allowNull: false },
  },
  { tableName: "zonal_offices", modelName: "ZonalOffice" }
);

module.exports = ZonalOffice;
