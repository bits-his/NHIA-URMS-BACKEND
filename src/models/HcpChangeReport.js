const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const HcpChangeReport = sequelize.define(
  "HcpChangeReport",
  stateOfficeHeaderFields(),
  { tableName: "hcp_change_reports", modelName: "HcpChangeReport" }
);

module.exports = HcpChangeReport;
