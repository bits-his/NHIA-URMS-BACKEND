const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * SERVICOM complaint comment — flat thread line.
 * Composite PK (complaint_number, comment_seq). No surrogate id.
 */
const ServicomComplaintComment = sequelize.define(
  "ServicomComplaintComment",
  {
    complaint_number: {
      type: DataTypes.STRING(60),
      allowNull: false,
      primaryKey: true,
      references: { model: "servicom_complaints", key: "complaint_number" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    comment_seq: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    body: { type: DataTypes.TEXT, allowNull: false },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "servicom_complaint_comments",
    modelName: "ServicomComplaintComment",
  },
);

module.exports = ServicomComplaintComment;
