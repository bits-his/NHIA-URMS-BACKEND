const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * HCF Customer Satisfaction Survey — header.
 * Primary key is system-generated reference_id (e.g. SAT-2026-00001). No auto-increment id.
 */
const ServicomSatisfactionSurvey = sequelize.define(
  "ServicomSatisfactionSurvey",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "units", key: "unit_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    provider_name: { type: DataTypes.STRING(200), allowNull: false },
    survey_date: { type: DataTypes.DATEONLY, allowNull: false },
    team: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    total_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    max_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 17 },
    percentage_score: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "servicom_satisfaction_surveys",
    modelName: "ServicomSatisfactionSurvey",
    indexes: [
      { fields: ["state_code", "survey_date"] },
      { fields: ["zonal_code", "survey_date"] },
    ],
  },
);

module.exports = ServicomSatisfactionSurvey;
