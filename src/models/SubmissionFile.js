const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Uploads attached to a submission or to one of its lines. */
const SubmissionFile = sequelize.define("SubmissionFile", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  submission_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: "submissions", key: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },
  line_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "submission_lines", key: "id" },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  },
  file_path: { type: DataTypes.STRING(500), allowNull: false },
  original_name: { type: DataTypes.STRING(255), allowNull: true },
  kind: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "attachment" },
}, {
  tableName: "submission_files",
  modelName: "SubmissionFile",
  indexes: [
    { name: "submission_files_parent_idx", fields: ["submission_id"] },
  ],
});

module.exports = SubmissionFile;
