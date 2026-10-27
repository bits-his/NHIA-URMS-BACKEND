const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormAnswer = sequelize.define(
  "FormAnswer",
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
      allowNull: false,
      references: { model: "form_fields", key: "id" },
    },
    value_text: { type: DataTypes.TEXT, allowNull: true },
    value_number: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
    value_date: { type: DataTypes.DATEONLY, allowNull: true },
    value_bool: { type: DataTypes.BOOLEAN, allowNull: true },
    value_json: { type: DataTypes.JSON, allowNull: true },
    lookup_value_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "lookup_values", key: "id" },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "form_answers",
    modelName: "FormAnswer",
    indexes: [{ unique: true, fields: ["submission_id", "field_id"], name: "uq_answer" }],
  },
);

module.exports = FormAnswer;
