const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomAuditLog = sequelize.define("ServicomAuditLog", {
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  entity_type: { type: DataTypes.STRING(50), allowNull: false },
  entity_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  action:      { type: DataTypes.STRING(80), allowNull: false },
  actor:       { type: DataTypes.STRING(100), allowNull: true },
  details:     { type: DataTypes.JSON, allowNull: true },
}, { tableName: "servicom_audit_logs", modelName: "ServicomAuditLog" });

module.exports = ServicomAuditLog;
