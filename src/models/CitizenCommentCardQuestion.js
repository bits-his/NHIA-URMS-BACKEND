const { DataTypes } = require("sequelize");
const sequelizeCommentCards = require("../config/databaseCommentCards");

const CitizenCommentCardQuestion = sequelizeCommentCards.define(
  "CitizenCommentCardQuestion",
  {
    question_id: { type: DataTypes.STRING(10), primaryKey: true },
    section:     { type: DataTypes.STRING(100), allowNull: false },
    question:    { type: DataTypes.STRING(500), allowNull: false },
    scale:       { type: DataTypes.ENUM("4", "5"), allowNull: false },
    sort_order:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "citizen_comment_card_questions",
    modelName: "CitizenCommentCardQuestion",
    updatedAt: false,
  },
);

module.exports = CitizenCommentCardQuestion;
