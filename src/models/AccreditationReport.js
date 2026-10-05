const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const { DataTypes } = require("sequelize");

const AccreditationReport = sequelize.define(
  "AccreditationReport",
  {
    ...stateOfficeHeaderFields(),
    planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    activity_module: { type: DataTypes.STRING(60), allowNull: true },
  },
  { tableName: "accreditation_reports", modelName: "AccreditationReport" }
);

module.exports = AccreditationReport;
