const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StateOfficeMysteryShopping = sequelize.define("StateOfficeMysteryShopping", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  zone_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "zonal_offices", key: "id" },
  },
  state_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_offices", key: "id" },
  },
  reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  mystery_shopper_name: { type: DataTypes.STRING(255), allowNull: true },
  facility_name: { type: DataTypes.STRING(255), allowNull: false },
  facility_nhia_code: { type: DataTypes.STRING(80), allowNull: true },
  facility_type: {
    type: DataTypes.ENUM("primary_only", "secondary_only", "primary_and_secondary"),
    allowNull: true,
  },
  facility_email: { type: DataTypes.STRING(255), allowNull: true },
  visit_date: { type: DataTypes.DATEONLY, allowNull: true },
  observations: { type: DataTypes.JSON, allowNull: true },
  standard_expectations_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true, defaultValue: 0 },
  enrollee_card_1: { type: DataTypes.JSON, allowNull: true },
  enrollee_score_1: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true, defaultValue: 0 },
  enrollee_card_2: { type: DataTypes.JSON, allowNull: true },
  enrollee_score_2: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true, defaultValue: 0 },
  enrollee_card_3: { type: DataTypes.JSON, allowNull: true },
  enrollee_score_3: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true, defaultValue: 0 },
  key_strengths: { type: DataTypes.TEXT, allowNull: true },
  gaps_identified: { type: DataTypes.TEXT, allowNull: true },
  recommendation: { type: DataTypes.TEXT, allowNull: true },
  follow_up_action_plan: { type: DataTypes.TEXT, allowNull: true },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false,
    defaultValue: "draft",
  },
}, { tableName: "state_office_mystery_shopping", modelName: "StateOfficeMysteryShopping" });

module.exports = StateOfficeMysteryShopping;
