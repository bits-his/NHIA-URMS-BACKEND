const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomSatisfactionSurvey = sequelize.define("ServicomSatisfactionSurvey", {
  id:               { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id:     { type: DataTypes.STRING(30), allowNull: false, unique: true },
  zone_id:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  state_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  provider_name:    { type: DataTypes.STRING(200), allowNull: false },
  survey_date:      { type: DataTypes.DATEONLY, allowNull: false },
  survey_officers:  { type: DataTypes.STRING(250), allowNull: true },
  team:             { type: DataTypes.STRING(150), allowNull: true },
  responses:        { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  total_score:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  max_score:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  percentage_score: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
  created_by:       { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: "servicom_satisfaction_surveys", modelName: "ServicomSatisfactionSurvey" });

module.exports = ServicomSatisfactionSurvey;
