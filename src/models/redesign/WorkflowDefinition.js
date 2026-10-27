const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const WorkflowDefinition = sequelize.define(
  "WorkflowDefinition",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    key_name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "workflow_definitions", modelName: "WorkflowDefinition", timestamps: false },
);

module.exports = WorkflowDefinition;
