const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const ChallengesReport = sequelize.define(
  "ChallengesReport",
  {
    ...stateOfficeHeaderFields(),
    // legacy free-text fields retained for older reports
    challenges: { type: DataTypes.TEXT, allowNull: true },
    recommendations: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "challenges_reports", modelName: "ChallengesReport" }
);

module.exports = ChallengesReport;
