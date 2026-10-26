const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const { DataTypes } = require("sequelize");

const HcpChangeReport = sequelize.define(
  "HcpChangeReport",
  {
    ...stateOfficeHeaderFields(),
    endorsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "hcp_change_reports", modelName: "HcpChangeReport" }
);

module.exports = HcpChangeReport;
