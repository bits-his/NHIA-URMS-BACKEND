const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DimGeography = sequelize.define(
  "DimGeography",
  {
    geo_key: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "zonal_offices", key: "id" },
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "state_offices", key: "id" },
    },
    zone_code: { type: DataTypes.STRING(20), allowNull: false },
    zone_name: { type: DataTypes.STRING(120), allowNull: false },
    state_code: { type: DataTypes.STRING(20), allowNull: false },
    state_name: { type: DataTypes.STRING(120), allowNull: false },
  },
  {
    tableName: "dim_geography",
    modelName: "DimGeography",
    timestamps: false,
    indexes: [{ unique: true, fields: ["zone_id", "state_id"], name: "uq_dim_geo" }],
  },
);

module.exports = DimGeography;
