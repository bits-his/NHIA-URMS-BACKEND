const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const ComplaintsComplianceReport = sequelize.define(
  "ComplaintsComplianceReport",
  stateOfficeHeaderFields(),
  { tableName: "complaints_compliance_reports", modelName: "ComplaintsComplianceReport" }
);

module.exports = ComplaintsComplianceReport;
