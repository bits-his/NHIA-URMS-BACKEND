const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Ad-hoc / Special Assignment — SDO Master Assignment Register
 * Represents the official instruction received by SDO from an originating department.
 */
const AdhocMasterAssignment = sequelize.define(
  "AdhocMasterAssignment",
  {
    master_assignment_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    assignment_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    originating_department_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    originating_department_other: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    date_received: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM("normal", "high", "urgent"),
      allowNull: false,
      defaultValue: "normal",
    },
    reference_memo_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    received_through: {
      type: DataTypes.ENUM("official_memo", "email", "letter", "circular", "other"),
      allowNull: false,
      defaultValue: "official_memo",
    },
    received_through_other: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    date_on_instruction: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    sdo_officer_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    sdo_officer_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    assignment_due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    assignment_description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expected_output: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    original_instruction_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    original_instruction_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reporting_requirement: {
      type: DataTypes.ENUM("final", "periodic", "both"),
      allowNull: false,
      defaultValue: "final",
    },
    additional_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "dispatched", "closed"),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "adhoc_master_assignments",
    modelName: "AdhocMasterAssignment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = AdhocMasterAssignment;
