const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WeeklyActionableReport = sequelize.define("WeeklyActionableReport", {
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
  reporting_week:  { type: DataTypes.TINYINT.UNSIGNED,  allowNull: false, defaultValue: 1,
                     comment: "Week of the month: 1-4" },
  submission_date: { type: DataTypes.DATEONLY, allowNull: true },
  submitted_by:    { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false, defaultValue: "draft",
  },
}, { tableName: "weekly_actionable_reports", modelName: "WeeklyActionableReport" });

module.exports = WeeklyActionableReport;
