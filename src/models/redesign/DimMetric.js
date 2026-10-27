const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DimMetric = sequelize.define(
  "DimMetric",
  {
    metric_key: { type: DataTypes.STRING(80), primaryKey: true },
    label: { type: DataTypes.STRING(150), allowNull: false },
    category: { type: DataTypes.STRING(80), allowNull: true },
    unit: { type: DataTypes.STRING(40), allowNull: true },
    aggregation: {
      type: DataTypes.ENUM("sum", "avg", "max", "min", "last"),
      allowNull: false,
      defaultValue: "sum",
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "dim_metric", modelName: "DimMetric", timestamps: false },
);

module.exports = DimMetric;
