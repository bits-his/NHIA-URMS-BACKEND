const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StateOfficeReconciliationMeeting = sequelize.define("StateOfficeReconciliationMeeting", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
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
  hmo: { type: DataTypes.STRING(255), allowNull: false },
  hmo_code: { type: DataTypes.STRING(50), allowNull: true },
  facility: { type: DataTypes.STRING(255), allowNull: false },
  amount_owed: { type: DataTypes.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
  recon_status: { type: DataTypes.STRING(100), allowNull: true },
  comment: { type: DataTypes.STRING(500), allowNull: true },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false,
    defaultValue: "submitted",
  },
}, { tableName: "state_office_reconciliation_meetings", modelName: "StateOfficeReconciliationMeeting" });

module.exports = StateOfficeReconciliationMeeting;
