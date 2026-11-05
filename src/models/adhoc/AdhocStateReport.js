const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Ad-hoc / Special Assignment — State Report Submission
 * Short report and evidence submitted by the State reporting officer against the State Assignment ID.
 */
const AdhocStateReport = sequelize.define(
  "AdhocStateReport",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    state_assignment_id: {
      type: DataTypes.STRING(40),
      allowNull: false,
      references: { model: "adhoc_state_assignments", key: "state_assignment_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    report_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },
    completion_status: {
      type: DataTypes.ENUM("ongoing", "partially_completed", "completed"),
      allowNull: false,
      defaultValue: "completed",
    },
    date_completed: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    work_summary: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    output_achieved: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    challenges: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    evidence_files: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    review_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "submitted",
    },
    clarification_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    submitted_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    submitted_by_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    reviewed_by_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "adhoc_state_reports",
    modelName: "AdhocStateReport",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = AdhocStateReport;
