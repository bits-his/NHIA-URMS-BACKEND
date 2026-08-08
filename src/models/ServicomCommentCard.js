const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomCommentCard = sequelize.define("ServicomCommentCard", {
  id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id:    { type: DataTypes.STRING(30), allowNull: false, unique: true },
  zone_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  state_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  respondent_name: { type: DataTypes.STRING(150), allowNull: true },
  organisation:    { type: DataTypes.STRING(200), allowNull: true },
  card_date:       { type: DataTypes.DATEONLY, allowNull: false },
  responses:       { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  total_score:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  average_score:   { type: DataTypes.DECIMAL(4, 2), allowNull: true },
  created_by:      { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: "servicom_comment_cards", modelName: "ServicomCommentCard" });

module.exports = ServicomCommentCard;
