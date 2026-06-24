const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomEvidence = sequelize.define("ServicomEvidence", {
  id:           { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  visit_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  file_name:    { type: DataTypes.STRING(255), allowNull: false },
  file_path:    { type: DataTypes.STRING(500), allowNull: false },
  file_type:    { type: DataTypes.STRING(80), allowNull: true },
  mime_type:    { type: DataTypes.STRING(120), allowNull: true },
  file_size:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  description:  { type: DataTypes.STRING(255), allowNull: true },
  uploaded_by:  { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: "servicom_evidence_uploads", modelName: "ServicomEvidence" });

module.exports = ServicomEvidence;
