const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const AccreditationReport = sequelize.define(
  "AccreditationReport",
  stateOfficeHeaderFields(),
  { tableName: "accreditation_reports", modelName: "AccreditationReport" }
);

module.exports = AccreditationReport;
