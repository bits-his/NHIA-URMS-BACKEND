const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StateOffice = sequelize.define(
  "StateOffice",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(100), allowNull: false },
    zonal_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "zonal_offices", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    is_hq: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_zonal_office: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "state_offices", modelName: "StateOffice" }
);

module.exports = StateOffice;
