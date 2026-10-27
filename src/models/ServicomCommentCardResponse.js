const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Citizens' Comment Card — one scored answer line (Q01–Q05).
 * Composite PK (reference_id, question_id); no surrogate id.
 */
const ServicomCommentCardResponse = sequelize.define(
  "ServicomCommentCardResponse",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "servicom_comment_cards", key: "reference_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    question_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
      primaryKey: true,
    },
    section: { type: DataTypes.STRING(40), allowNull: true },
    question_text: { type: DataTypes.STRING(500), allowNull: true },
    scale_max: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    response_value: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    score: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  },
  {
    tableName: "servicom_comment_card_responses",
    modelName: "ServicomCommentCardResponse",
  },
);

module.exports = ServicomCommentCardResponse;
