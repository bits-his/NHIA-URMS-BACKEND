const { DataTypes } = require("sequelize");
const sequelizeCommentCards = require("../config/databaseCommentCards");

const CitizenCommentCardAnswer = sequelizeCommentCards.define(
  "CitizenCommentCardAnswer",
  {
    id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    comment_card_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    question_id:     { type: DataTypes.STRING(10), allowNull: false },
    response:        { type: DataTypes.STRING(20), allowNull: false },
    score:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  {
    tableName: "citizen_comment_card_answers",
    modelName: "CitizenCommentCardAnswer",
    indexes: [
      { unique: true, fields: ["comment_card_id", "question_id"] },
    ],
  },
);

module.exports = CitizenCommentCardAnswer;
