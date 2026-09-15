const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MonthlyEnrolleeRegister = sequelize.define("MonthlyEnrolleeRegister", {
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
  reporting_year:  { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED,  allowNull: false },
  self_paying:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  ops:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  retirees:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  constituency:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  gifship:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  formal_sector:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  total_lives:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  submission_date: { type: DataTypes.DATEONLY, allowNull: true },
  submitted_by:    { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false, defaultValue: "draft",
  },
}, {
  tableName: "monthly_enrollee_registers",
  modelName: "MonthlyEnrolleeRegister",
  indexes: [
    { unique: true, name: "mer_zone_state_period", fields: ["zone_id", "state_id", "reporting_year", "reporting_month"] },
  ],
});

module.exports = MonthlyEnrolleeRegister;
