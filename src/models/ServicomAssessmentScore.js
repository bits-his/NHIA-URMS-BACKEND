const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomAssessmentScore = sequelize.define("ServicomAssessmentScore", {
  id:           { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  visit_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  indicator_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  score:        { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 1, max: 5 } },
}, { tableName: "servicom_assessment_scores", modelName: "ServicomAssessmentScore" });

module.exports = ServicomAssessmentScore;
