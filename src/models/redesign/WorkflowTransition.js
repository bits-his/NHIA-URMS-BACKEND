const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const WorkflowTransition = sequelize.define(
  "WorkflowTransition",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    workflow_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "workflow_definitions", key: "id" },
      onDelete: "CASCADE",
    },
    from_status: { type: DataTypes.STRING(40), allowNull: false },
    action: { type: DataTypes.STRING(40), allowNull: false },
    to_status: { type: DataTypes.STRING(40), allowNull: false },
    required_flag: {
      type: DataTypes.ENUM("create", "review", "admin", "any"),
      allowNull: false,
      defaultValue: "any",
    },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "workflow_transitions",
    modelName: "WorkflowTransition",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["workflow_id", "from_status", "action"], name: "uq_transition" },
    ],
  },
);

module.exports = WorkflowTransition;
