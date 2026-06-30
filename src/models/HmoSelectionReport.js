const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const HmoSelectionReport = sequelize.define(
  "HmoSelectionReport",
  stateOfficeHeaderFields(),
  { tableName: "hmo_selection_reports", modelName: "HmoSelectionReport" }
);

module.exports = HmoSelectionReport;
