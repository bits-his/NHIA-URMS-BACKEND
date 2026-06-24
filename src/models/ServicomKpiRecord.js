const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomKpiRecord = sequelize.define("ServicomKpiRecord", {
  id:                          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  visit_id:                    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  enrollees_served:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  avg_waiting_time_mins:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  complaints_received:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  complaints_resolved:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
  claims_within_timeline:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  beneficiary_satisfaction_rate:{ type: DataTypes.DECIMAL(5, 1), allowNull: true },
  facilities_meeting_standards:{ type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  resolution_rate:             { type: DataTypes.DECIMAL(5, 1), allowNull: true },
  compliance_rate:             { type: DataTypes.DECIMAL(5, 1), allowNull: true },
  performance_score:           { type: DataTypes.DECIMAL(5, 1), allowNull: true },
}, { tableName: "servicom_kpi_records", modelName: "ServicomKpiRecord" });

module.exports = ServicomKpiRecord;
