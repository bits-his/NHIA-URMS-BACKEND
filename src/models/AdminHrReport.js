const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { stateOfficeHeaderFields } = require("./stateOfficeHeaderFields");

/**
 * Admin / HR reports under State Offices.
 * Structured form fields live in `payload` (JSON) so nested sections can vary by type.
 */
const AdminHrReport = sequelize.define(
  "AdminHrReport",
  {
    ...stateOfficeHeaderFields(),
    report_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: "admin_hr_reports",
    modelName: "AdminHrReport",
    indexes: [
      { name: "ahr_report_type_idx", fields: ["report_type"] },
      {
        name: "ahr_scope_type_idx",
        fields: ["zone_id", "state_id", "reporting_year", "reporting_month", "report_type"],
      },
    ],
  }
);

module.exports = AdminHrReport;
