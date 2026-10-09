const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Enforcement — Weekly Compliance Reporting Template (compliance officers at HCFs). */
const StateOfficeWeeklyCompliance = sequelize.define("StateOfficeWeeklyCompliance", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  zone_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "zonal_offices", key: "id" },
  },
  state_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_offices", key: "id" },
  },
  reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  reporting_week: { type: DataTypes.STRING(10), allowNull: false },
  facility_id: { type: DataTypes.STRING(40), allowNull: true },
  facility_name: { type: DataTypes.STRING(255), allowNull: false },
  nhia_code: { type: DataTypes.STRING(60), allowNull: true },
  facility_type: { type: DataTypes.STRING(30), allowNull: true },
  facility_type_other: { type: DataTypes.STRING(120), allowNull: true },
  facility_address: { type: DataTypes.STRING(500), allowNull: true },
  compliance_officer: { type: DataTypes.STRING(150), allowNull: true },
  designation_staff_id: { type: DataTypes.STRING(150), allowNull: true },
  submission_date: { type: DataTypes.DATEONLY, allowNull: true },
  /** { [indicatorKey]: { answer: "yes" | "no", remarks: string } } */
  indicators: {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const raw = this.getDataValue("indicators");
      if (!raw) return {};
      if (typeof raw === "string") {
        try { return JSON.parse(raw) || {}; } catch { return {}; }
      }
      return raw;
    },
  },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false,
    defaultValue: "draft",
  },
}, { tableName: "state_office_weekly_compliance", modelName: "StateOfficeWeeklyCompliance" });

module.exports = StateOfficeWeeklyCompliance;
