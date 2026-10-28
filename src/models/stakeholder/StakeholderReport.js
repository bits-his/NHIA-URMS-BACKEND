const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Stakeholder engagement — one row per engagement.
 * PK reference_id (no auto-increment id). Multi-selects are pipe-delimited TEXT.
 */
const StakeholderReport = sequelize.define(
  "StakeholderReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    activity_module: {
      type: DataTypes.STRING(60),
      allowNull: false,
      defaultValue: "engagement-coordination",
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    department_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "departments", key: "department_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "units", key: "unit_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
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
    coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
    coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    engagement_code: { type: DataTypes.STRING(20), allowNull: true },
    activity_date: { type: DataTypes.DATEONLY, allowNull: true },
    engagement_category: { type: DataTypes.STRING(120), allowNull: false },
    stakeholder_categories: { type: DataTypes.TEXT, allowNull: true },
    stakeholder_names: { type: DataTypes.TEXT, allowNull: true },
    specific_activity: { type: DataTypes.TEXT, allowNull: true },
    engagement_purpose: { type: DataTypes.TEXT, allowNull: true },
    funding_option: { type: DataTypes.STRING(80), allowNull: true },
    activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    planned_target_audience_text: { type: DataTypes.STRING(255), allowNull: true },
    target_audience_reached: { type: DataTypes.TEXT, allowNull: true },
    location_category: { type: DataTypes.STRING(80), allowNull: true },
    location_name: { type: DataTypes.STRING(120), allowNull: true },
    location_specify: { type: DataTypes.STRING(255), allowNull: true },
    programs_supported: { type: DataTypes.TEXT, allowNull: true },
    supporting_evidence_types: { type: DataTypes.TEXT, allowNull: true },

    follow_up_required: { type: DataTypes.STRING(10), allowNull: true },
    follow_up_date: { type: DataTypes.DATEONLY, allowNull: true },
    follow_up_visits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    follow_up_priority: { type: DataTypes.STRING(40), allowNull: true },
    follow_up_action: { type: DataTypes.TEXT, allowNull: true },
    follow_up_responsible: { type: DataTypes.STRING(120), allowNull: true },
    follow_up_status: { type: DataTypes.STRING(40), allowNull: true },
    follow_up_activity_conducted: { type: DataTypes.TEXT, allowNull: true },
    follow_up_findings: { type: DataTypes.TEXT, allowNull: true },
    follow_up_outstanding_issues: { type: DataTypes.TEXT, allowNull: true },
    follow_up_further_action: { type: DataTypes.TEXT, allowNull: true },

    activity_status: { type: DataTypes.STRING(40), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    expected_output: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "stakeholder_reports",
    modelName: "StakeholderReport",
    indexes: [
      {
        fields: ["activity_module", "zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_stakeholder_module_state_period",
      },
    ],
  },
);

module.exports = StakeholderReport;
