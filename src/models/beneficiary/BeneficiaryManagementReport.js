const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const ACTIVITY_ENUM = [
  "additional_dependant",
  "extra_dependant",
  "hcp_change",
  "hmo_change",
  "mda_hmo_selection",
];

/**
 * Beneficiary Management — one row per register activity.
 * PK reference_id (no auto-increment id).
 */
const BeneficiaryManagementReport = sequelize.define(
  "BeneficiaryManagementReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    activity_type: {
      type: DataTypes.ENUM(...ACTIVITY_ENUM),
      allowNull: false,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
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
    enrolment_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: true,
      references: { model: "enrolment_reports", key: "reference_id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    endorsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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

    enrollee_name: { type: DataTypes.STRING(150), allowNull: true },
    nhia_number: { type: DataTypes.STRING(50), allowNull: true },
    program_name: { type: DataTypes.STRING(80), allowNull: true },
    mda: { type: DataTypes.STRING(255), allowNull: true },
    request_date: { type: DataTypes.DATEONLY, allowNull: true },
    process_end_date: { type: DataTypes.DATEONLY, allowNull: true },
    activity_status: { type: DataTypes.STRING(60), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },

    request_kind: {
      type: DataTypes.ENUM("additional", "extra"),
      allowNull: true,
    },
    dependant_entity: { type: DataTypes.STRING(40), allowNull: true },
    relationship_kind: { type: DataTypes.STRING(40), allowNull: true },
    hcf: { type: DataTypes.STRING(255), allowNull: true },
    alternative_provider: { type: DataTypes.STRING(255), allowNull: true },
    surname: { type: DataTypes.STRING(100), allowNull: true },
    first_name: { type: DataTypes.STRING(100), allowNull: true },
    middle_name: { type: DataTypes.STRING(100), allowNull: true },
    nin: { type: DataTypes.STRING(20), allowNull: true },
    blood_group: { type: DataTypes.STRING(10), allowNull: true },
    marital_status: { type: DataTypes.STRING(40), allowNull: true },
    state_of_origin: { type: DataTypes.STRING(80), allowNull: true },
    lga_of_origin: { type: DataTypes.STRING(80), allowNull: true },
    state_of_residence: { type: DataTypes.STRING(80), allowNull: true },
    lga_of_residence: { type: DataTypes.STRING(80), allowNull: true },
    phone_number: { type: DataTypes.STRING(40), allowNull: true },
    hmo_name: { type: DataTypes.STRING(255), allowNull: true },

    change_entity_type: {
      type: DataTypes.ENUM("hcp", "hmo"),
      allowNull: true,
    },
    current_provider: { type: DataTypes.STRING(255), allowNull: true },
    new_provider: { type: DataTypes.STRING(255), allowNull: true },
    reason_category: { type: DataTypes.STRING(200), allowNull: true },
    reason_other: { type: DataTypes.TEXT, allowNull: true },
    met_criteria: { type: DataTypes.STRING(10), allowNull: true },
    record_date: { type: DataTypes.DATEONLY, allowNull: true },

    selection_date: { type: DataTypes.DATEONLY, allowNull: true },
    former_hmo: { type: DataTypes.STRING(255), allowNull: true },
    selected_hmo: { type: DataTypes.STRING(255), allowNull: true },
    reason_for_change: { type: DataTypes.TEXT, allowNull: true },
    hmos_invited: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    hmos_attended: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    hmos_in_attendance: { type: DataTypes.STRING(500), allowNull: true },
    compliance_guideline: { type: DataTypes.STRING(10), allowNull: true },
    transparent_process: { type: DataTypes.STRING(10), allowNull: true },
  },
  {
    tableName: "beneficiary_management_reports",
    modelName: "BeneficiaryManagementReport",
    indexes: [
      {
        fields: ["activity_type", "zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_bm_activity_state_period",
      },
      { fields: ["enrolment_reference_id"] },
      { fields: ["nhia_number"] },
    ],
  },
);

module.exports = BeneficiaryManagementReport;
