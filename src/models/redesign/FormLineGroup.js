const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormLineGroup = sequelize.define(
  "FormLineGroup",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    submission_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_submissions", key: "id" },
      onDelete: "CASCADE",
    },
    section_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_sections", key: "id" },
    },
    line_index: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  {
    tableName: "form_line_groups",
    modelName: "FormLineGroup",
    updatedAt: false,
    indexes: [
      { unique: true, fields: ["submission_id", "section_id", "line_index"], name: "uq_line_group" },
    ],
  },
);

module.exports = FormLineGroup;
