const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormSection = sequelize.define(
  "FormSection",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    version_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_template_versions", key: "id" },
      onDelete: "CASCADE",
    },
    key_name: { type: DataTypes.STRING(80), allowNull: false },
    title: { type: DataTypes.STRING(150), allowNull: false },
    is_repeating: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "form_sections",
    modelName: "FormSection",
    timestamps: false,
    indexes: [{ unique: true, fields: ["version_id", "key_name"], name: "uq_section_key" }],
  },
);

module.exports = FormSection;
