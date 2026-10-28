const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FORM_ENUM = [
  "accreditation",
  "reaccreditation",
  "qa-inspections",
  "medical-audits",
];

/**
 * Provider Management — one row per activity.
 * PK reference_id (no auto-increment id, no lines table).
 */
const ProviderManagementReport = sequelize.define(
  "ProviderManagementReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    form_type: {
      type: DataTypes.ENUM(...FORM_ENUM),
      allowNull: false,
    },
    engagement_code: { type: DataTypes.STRING(20), allowNull: true },
    engagement_category: { type: DataTypes.STRING(120), allowNull: true },
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

    related_programme: { type: DataTypes.STRING(40), allowNull: true },
    bhcpf_activity_type: { type: DataTypes.STRING(40), allowNull: true },
    activity_date: { type: DataTypes.DATEONLY, allowNull: true },
    total_facilities_in_state: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    facilities_planned: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    facilities_covered: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    funding_option: { type: DataTypes.STRING(80), allowNull: true },
    activity_budget: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    approved_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    activity_status: { type: DataTypes.STRING(40), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },

    applications_received: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    forms_sold: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    completed_forms_returned: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    awaiting_accreditation: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    awaiting_reaccreditation: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    phcs_awaiting_accreditation: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    phcs_awaiting_reaccreditation: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    supporting_evidence_types: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "provider_management_reports",
    modelName: "ProviderManagementReport",
    indexes: [
      {
        fields: ["form_type", "zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_pm_form_state_period",
      },
    ],
  },
);

module.exports = ProviderManagementReport;
