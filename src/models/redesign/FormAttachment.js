const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormAttachment = sequelize.define(
  "FormAttachment",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    submission_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_submissions", key: "id" },
      onDelete: "CASCADE",
    },
    field_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "form_fields", key: "id" },
      onDelete: "SET NULL",
    },
    line_group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "form_line_groups", key: "id" },
      onDelete: "CASCADE",
    },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    original_name: { type: DataTypes.STRING(255), allowNull: true },
    mime_type: { type: DataTypes.STRING(120), allowNull: true },
    size_bytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    uploaded_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "form_attachments",
    modelName: "FormAttachment",
    updatedAt: false,
  },
);

module.exports = FormAttachment;
