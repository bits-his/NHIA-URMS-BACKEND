const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DimDate = sequelize.define(
  "DimDate",
  {
    date_key: { type: DataTypes.INTEGER, primaryKey: true },
    full_date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
    year_num: { type: DataTypes.SMALLINT, allowNull: false },
    quarter_num: { type: DataTypes.TINYINT, allowNull: false },
    month_num: { type: DataTypes.TINYINT, allowNull: false },
    week_num: { type: DataTypes.TINYINT, allowNull: true },
    month_name: { type: DataTypes.STRING(20), allowNull: false },
  },
  { tableName: "dim_date", modelName: "DimDate", timestamps: false },
);

module.exports = DimDate;
