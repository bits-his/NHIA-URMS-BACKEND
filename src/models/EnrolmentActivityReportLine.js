const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Enrolment Activity Reporting — activity line.
 * Composite PK (reference_id, line_no); no surrogate id.
 */
const EnrolmentActivityReportLine = sequelize.define(
  "EnrolmentActivityReportLine",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "enrolment_activity_reports", key: "reference_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    line_no: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    activity_code: { type: DataTypes.STRING(20), allowNull: true },
    activity_date: { type: DataTypes.DATEONLY, allowNull: true },
    enrolment_channel: { type: DataTypes.STRING(50), allowNull: true },
    enrolment_type: { type: DataTypes.STRING(40), allowNull: true },
    program_code: { type: DataTypes.STRING(20), allowNull: true },
    program_name: { type: DataTypes.STRING(100), allowNull: true },
    enrolment_category: { type: DataTypes.STRING(100), allowNull: true },
    beneficiary_category: { type: DataTypes.STRING(80), allowNull: true },
    beneficiary_status: { type: DataTypes.STRING(80), allowNull: true },
    funding_option: { type: DataTypes.STRING(80), allowNull: true },
    supporting_evidence: { type: DataTypes.STRING(120), allowNull: true },
    status_reason: { type: DataTypes.TEXT, allowNull: true },
    activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    enrolment_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    enrollees_validated: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    activity_status: { type: DataTypes.STRING(40), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    /** Program-/activity-specific capture (NIN, ID card, HMO/HCF soft refs, etc.) */
    program_details: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const raw = this.getDataValue("program_details");
        if (!raw) return null;
        if (typeof raw === "object") return raw;
        if (typeof raw === "string") {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        }
        return null;
      },
    },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  },
  {
    tableName: "enrolment_activity_report_lines",
    modelName: "EnrolmentActivityReportLine",
    // Must match parent header collation for FK creation
    charset: "utf8mb4",
    collate: "utf8mb4_general_ci",
  },
);

module.exports = EnrolmentActivityReportLine;
