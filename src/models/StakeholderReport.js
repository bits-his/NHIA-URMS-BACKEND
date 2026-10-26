const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

const header = stateOfficeHeaderFields();

const StakeholderReport = sequelize.define(
  "StakeholderReport",
  {
    ...header,
    /** Same endorsement workflow as Provider Management (RO final-submits after SC endorse). */
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
  { tableName: "stakeholder_reports", modelName: "StakeholderReport" }
);

module.exports = StakeholderReport;
