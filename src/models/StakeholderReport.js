const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const StakeholderReport = sequelize.define(
  "StakeholderReport",
  {
    ...stateOfficeHeaderFields(),
    planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    activity_module: { type: DataTypes.STRING(60), allowNull: true },
  },
  { tableName: "stakeholder_reports", modelName: "StakeholderReport" }
);

module.exports = StakeholderReport;
