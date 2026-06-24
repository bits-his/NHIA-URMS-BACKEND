const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MonitoringVisit = sequelize.define("MonitoringVisit", {
  id:                 { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id:       { type: DataTypes.STRING(30), allowNull: false, unique: true },
  zone_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  state_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  facility_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  lga:                { type: DataTypes.STRING(120), allowNull: true },
  facility_name:      { type: DataTypes.STRING(200), allowNull: false },
  facility_type:      {
    type: DataTypes.ENUM("public", "private", "primary", "secondary", "tertiary"),
    allowNull: false,
    defaultValue: "public",
  },
  address:            { type: DataTypes.STRING(255), allowNull: true },
  contact_person:     { type: DataTypes.STRING(150), allowNull: true },
  phone:              { type: DataTypes.STRING(30), allowNull: true },
  email:              { type: DataTypes.STRING(120), allowNull: true },
  visit_date:         { type: DataTypes.DATEONLY, allowNull: false },
  monitoring_type:    {
    type: DataTypes.ENUM("routine", "follow_up", "spot_check", "special_investigation"),
    allowNull: false,
    defaultValue: "routine",
  },
  monitoring_officer: { type: DataTypes.STRING(150), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "reviewed", "approved", "returned"),
    allowNull: false,
    defaultValue: "draft",
  },
  total_score:        { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
  percentage_score:   { type: DataTypes.DECIMAL(5, 1), allowNull: true },
  compliance_rating:  {
    type: DataTypes.ENUM("fully_compliant", "substantially_compliant", "partially_compliant", "non_compliant"),
    allowNull: true,
  },
  submitted_by:       { type: DataTypes.STRING(100), allowNull: true },
  reviewed_by:        { type: DataTypes.STRING(100), allowNull: true },
  reviewed_at:        { type: DataTypes.DATE, allowNull: true },
  review_note:        { type: DataTypes.TEXT, allowNull: true },
  approved_by:        { type: DataTypes.STRING(100), allowNull: true },
  approved_at:        { type: DataTypes.DATE, allowNull: true },
  returned_by:        { type: DataTypes.STRING(100), allowNull: true },
  returned_at:        { type: DataTypes.DATE, allowNull: true },
  return_reason:      { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "monitoring_visits", modelName: "MonitoringVisit" });

module.exports = MonitoringVisit;
