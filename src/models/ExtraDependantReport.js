const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const { DataTypes } = require("sequelize");

const ExtraDependantReport = sequelize.define(
  "ExtraDependantReport",
  {
    ...stateOfficeHeaderFields(),
    endorsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "extra_dependant_reports", modelName: "ExtraDependantReport" }
);

module.exports = ExtraDependantReport;
