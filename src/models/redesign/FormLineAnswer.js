const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FormLineAnswer = sequelize.define(
  "FormLineAnswer",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    line_group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_line_groups", key: "id" },
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
    tableName: "form_line_answers",
    modelName: "FormLineAnswer",
    timestamps: false,
    indexes: [{ unique: true, fields: ["line_group_id", "field_id"], name: "uq_line_answer" }],
  },
);

module.exports = FormLineAnswer;
