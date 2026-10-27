const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * HCF Customer Satisfaction Survey — one yes/no answer line (Q01–Q17).
 * Composite PK (reference_id, question_id); no surrogate id.
 */
const ServicomSatisfactionSurveyResponse = sequelize.define(
  "ServicomSatisfactionSurveyResponse",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "servicom_satisfaction_surveys", key: "reference_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    question_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
      primaryKey: true,
    },
    category: { type: DataTypes.STRING(40), allowNull: true },
    question_text: { type: DataTypes.STRING(500), allowNull: true },
    response_value: { type: DataTypes.STRING(3), allowNull: false },
    score: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  },
  {
    tableName: "servicom_satisfaction_survey_responses",
    modelName: "ServicomSatisfactionSurveyResponse",
  },
);

module.exports = ServicomSatisfactionSurveyResponse;
