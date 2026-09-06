const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const ChallengesReport = sequelize.define(
  "ChallengesReport",
  {
    ...stateOfficeHeaderFields(),
    challenges: { type: DataTypes.TEXT, allowNull: true },
    recommendations: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "challenges_reports", modelName: "ChallengesReport" }
);

module.exports = ChallengesReport;
