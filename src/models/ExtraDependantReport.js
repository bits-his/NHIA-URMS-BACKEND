const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const ExtraDependantReport = sequelize.define(
  "ExtraDependantReport",
  stateOfficeHeaderFields(),
  { tableName: "extra_dependant_reports", modelName: "ExtraDependantReport" }
);

module.exports = ExtraDependantReport;
