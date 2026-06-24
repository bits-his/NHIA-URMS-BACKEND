const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicomComplaint = sequelize.define("ServicomComplaint", {
  id:               { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  complaint_number: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  complaint_date:   { type: DataTypes.DATEONLY, allowNull: false },
  zone_id:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  state_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  facility_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  facility_name:    { type: DataTypes.STRING(200), allowNull: false },
  visit_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  category: {
    type: DataTypes.ENUM("delay_in_service", "staff_attitude", "claims_processing", "access_to_care", "drug_availability", "others"),
    allowNull: false,
    defaultValue: "others",
  },
  description:      { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM("open", "assigned", "in_progress", "resolved", "escalated", "closed"),
    allowNull: false,
    defaultValue: "open",
  },
  assigned_officer: { type: DataTypes.STRING(150), allowNull: true },
  resolution_notes: { type: DataTypes.TEXT, allowNull: true },
  resolution_date:  { type: DataTypes.DATEONLY, allowNull: true },
  created_by:       { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: "servicom_complaints", modelName: "ServicomComplaint" });

module.exports = ServicomComplaint;
