const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormField = sequelize.define(
  "FormField",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    section_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_sections", key: "id" },
      onDelete: "CASCADE",
    },
    key_name: { type: DataTypes.STRING(80), allowNull: false },
    label: { type: DataTypes.STRING(200), allowNull: false },
    data_type: {
      type: DataTypes.ENUM(
        "text",
        "textarea",
        "integer",
        "decimal",
        "date",
        "boolean",
        "lookup",
        "multi_lookup",
        "json",
        "file",
      ),
      allowNull: false,
    },
    lookup_domain_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "lookup_domains", key: "id" },
      onDelete: "SET NULL",
    },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_metric: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    metric_key: { type: DataTypes.STRING(80), allowNull: true },
    validation_json: { type: DataTypes.JSON, allowNull: true },
    ui_json: { type: DataTypes.JSON, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "form_fields",
    modelName: "FormField",
    timestamps: false,
    indexes: [{ unique: true, fields: ["section_id", "key_name"], name: "uq_field_key" }],
  },
);

module.exports = FormField;
