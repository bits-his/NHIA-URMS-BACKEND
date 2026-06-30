const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const StakeholderReport = sequelize.define(
  "StakeholderReport",
  stateOfficeHeaderFields(),
  { tableName: "stakeholder_reports", modelName: "StakeholderReport" }
);

module.exports = StakeholderReport;
