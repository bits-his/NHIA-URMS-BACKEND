const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const { DataTypes } = require("sequelize");

const header = stateOfficeHeaderFields();

const AccreditationReport = sequelize.define(
  "AccreditationReport",
  {
    ...header,
    /** Provider Management workflow (accreditation table only). */
    status: {
      type: DataTypes.ENUM(
        "draft",
        "awaiting_review",
        "returned",
        "endorsed",
        "submitted",
        "approved",
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    activity_module: { type: DataTypes.STRING(60), allowNull: true },
  },
  { tableName: "accreditation_reports", modelName: "AccreditationReport" }
);

module.exports = AccreditationReport;
