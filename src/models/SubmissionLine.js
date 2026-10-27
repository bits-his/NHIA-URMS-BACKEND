const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Repeating rows for a submission.
 * category, quantity, amount, and facility are real columns so dashboards can sum them.
 * The rest of the form row is in extra.
 */
const SubmissionLine = sequelize.define("SubmissionLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  submission_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: "submissions", key: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },
  line_no: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  category: { type: DataTypes.STRING(120), allowNull: true },
  quantity: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  amount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  facility_id: { type: DataTypes.STRING(64), allowNull: true },
  facility_name: { type: DataTypes.STRING(255), allowNull: true },
  quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  extra: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: "submission_lines",
  modelName: "SubmissionLine",
  indexes: [
    { name: "submission_lines_parent_idx", fields: ["submission_id"] },
    { name: "submission_lines_category_idx", fields: ["category"] },
  ],
});

module.exports = SubmissionLine;
