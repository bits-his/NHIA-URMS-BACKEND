const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const SubmissionStatusEvent = sequelize.define(
  "SubmissionStatusEvent",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    submission_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_submissions", key: "id" },
      onDelete: "CASCADE",
    },
    from_status: { type: DataTypes.STRING(40), allowNull: true },
    to_status: { type: DataTypes.STRING(40), allowNull: false },
    action: { type: DataTypes.STRING(40), allowNull: false },
    actor_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "submission_status_events",
    modelName: "SubmissionStatusEvent",
    updatedAt: false,
  },
);

module.exports = SubmissionStatusEvent;
