const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomRecommendation = sequelize.define("ServicomRecommendation", {
  id:                  { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  visit_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  description:         { type: DataTypes.TEXT, allowNull: false },
  priority:            { type: DataTypes.ENUM("high", "medium", "low"), allowNull: false, defaultValue: "medium" },
  responsible_officer: { type: DataTypes.STRING(150), allowNull: true },
  timeline:            { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM("open", "in_progress", "completed", "overdue"),
    allowNull: false,
    defaultValue: "open",
  },
}, { tableName: "servicom_recommendations", modelName: "ServicomRecommendation" });

module.exports = ServicomRecommendation;
