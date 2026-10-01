const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const EnrolmentDriveReport = sequelize.define(
  "EnrolmentDriveReport",
  {
    ...stateOfficeHeaderFields(),
    drive_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "advocacy" },
    planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  { tableName: "enrolment_drive_reports", modelName: "EnrolmentDriveReport" }
);

module.exports = EnrolmentDriveReport;
