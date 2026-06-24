const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomAssessmentIndicator = sequelize.define("ServicomAssessmentIndicator", {
  id:         { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  key:        { type: DataTypes.STRING(80), allowNull: false, unique: true },
  label:      { type: DataTypes.STRING(200), allowNull: false },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  is_active:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: "servicom_assessment_indicators", modelName: "ServicomAssessmentIndicator" });

module.exports = ServicomAssessmentIndicator;
