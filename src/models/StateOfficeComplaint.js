const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StateOfficeComplaint = sequelize.define("StateOfficeComplaint", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  complaint_number: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  zone_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "zonal_offices", key: "id" },
  },
  state_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "state_offices", key: "id" },
  },
  reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  against_type: {
    type: DataTypes.ENUM("against_hmo", "against_hcp"),
    allowNull: false,
  },
  entity_name: { type: DataTypes.STRING(255), allowNull: false },
  entity_code: { type: DataTypes.STRING(50), allowNull: true },
  complaint_date: { type: DataTypes.DATEONLY, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM("resolved", "unresolved", "pending", "escalated"),
    allowNull: false,
    defaultValue: "pending",
  },
  assigned_officer: { type: DataTypes.STRING(150), allowNull: true },
  resolution_notes: { type: DataTypes.TEXT, allowNull: true },
  resolution_date: { type: DataTypes.DATEONLY, allowNull: true },
  created_by: { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: "state_office_complaints", modelName: "StateOfficeComplaint" });

module.exports = StateOfficeComplaint;
