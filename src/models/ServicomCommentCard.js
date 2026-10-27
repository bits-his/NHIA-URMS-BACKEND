const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Citizens' Comment Card (Charter Performance) — header.
 * Primary key is system-generated reference_id (e.g. CCC-2026-00001). No auto-increment id.
 */
const ServicomCommentCard = sequelize.define(
  "ServicomCommentCard",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "units", key: "unit_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    card_date: { type: DataTypes.DATEONLY, allowNull: false },
    respondent_name: { type: DataTypes.STRING(150), allowNull: true },
    organisation: { type: DataTypes.STRING(200), allowNull: true },
    total_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    average_score: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "servicom_comment_cards",
    modelName: "ServicomCommentCard",
    indexes: [
      { fields: ["state_code", "card_date"] },
      { fields: ["zonal_code", "card_date"] },
    ],
  },
);

module.exports = ServicomCommentCard;
