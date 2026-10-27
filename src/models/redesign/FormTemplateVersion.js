const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormTemplateVersion = sequelize.define(
  "FormTemplateVersion",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    template_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_templates", key: "id" },
      onDelete: "CASCADE",
    },
    version_no: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    schema_json: { type: DataTypes.JSON, allowNull: true },
    published_at: { type: DataTypes.DATE, allowNull: true },
    published_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "form_template_versions",
    modelName: "FormTemplateVersion",
    updatedAt: false,
    indexes: [{ unique: true, fields: ["template_id", "version_no"], name: "uq_template_version" }],
  },
);

module.exports = FormTemplateVersion;
