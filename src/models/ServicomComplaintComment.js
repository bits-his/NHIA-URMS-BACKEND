const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomComplaintComment = sequelize.define("ServicomComplaintComment", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  complaint_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  created_by: { type: DataTypes.STRING(100), allowNull: true },
  created_by_staff_id: { type: DataTypes.STRING(50), allowNull: true },
}, { tableName: "servicom_complaint_comments", modelName: "ServicomComplaintComment" });

module.exports = ServicomComplaintComment;
