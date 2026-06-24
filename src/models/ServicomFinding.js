const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomFinding = sequelize.define("ServicomFinding", {
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  visit_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  finding_type:{ type: DataTypes.ENUM("strength", "challenge"), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "servicom_findings", modelName: "ServicomFinding" });

module.exports = ServicomFinding;
