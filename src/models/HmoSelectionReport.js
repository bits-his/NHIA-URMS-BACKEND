const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const { DataTypes } = require("sequelize");

const HmoSelectionReport = sequelize.define(
  "HmoSelectionReport",
  {
    ...stateOfficeHeaderFields(),
    endorsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "hmo_selection_reports", modelName: "HmoSelectionReport" }
);

module.exports = HmoSelectionReport;
