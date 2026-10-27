const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StateOffice = sequelize.define(
  "StateOffice",
  {
    /** Business primary key — no auto-increment id */
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      primaryKey: true,
    },
    description: { type: DataTypes.STRING(100), allowNull: false },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    is_hq: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_zonal_office: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "state_offices", modelName: "StateOffice" }
);

module.exports = StateOffice;
