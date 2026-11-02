const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Ad-hoc / Special Assignment — State Assignment Record
 * Represents an individual assignment dispatched to a specific State.
 */
const AdhocStateAssignment = sequelize.define(
  "AdhocStateAssignment",
  {
    state_assignment_id: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
    },
    master_assignment_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      references: { model: "adhoc_master_assignments", key: "master_assignment_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    state_due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dispatch_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dispatch_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    copy_zonal_coordinator: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    progress_status: {
      type: DataTypes.ENUM("not_started", "in_progress", "awaiting_support", "completed", "deferred", "cancelled"),
      allowNull: false,
      defaultValue: "not_started",
    },
    closure_status: {
      type: DataTypes.ENUM("open", "closed"),
      allowNull: false,
      defaultValue: "open",
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closed_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    closed_by_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    closure_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "adhoc_state_assignments",
    modelName: "AdhocStateAssignment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = AdhocStateAssignment;
