const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormTemplate = sequelize.define(
  "FormTemplate",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    feature_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "features", key: "id" },
    },
    key_name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    period_type: {
      type: DataTypes.ENUM("none", "week", "month", "quarter", "year"),
      allowNull: false,
      defaultValue: "month",
    },
    workflow_key: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "so_simple" },
    allow_lines: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "form_templates", modelName: "FormTemplate" },
);

module.exports = FormTemplate;
