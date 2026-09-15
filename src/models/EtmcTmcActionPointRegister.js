const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const EtmcTmcActionPointRegister = sequelize.define("EtmcTmcActionPointRegister", {
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
  reporting_year:  { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  reporting_month: { type: DataTypes.TINYINT.UNSIGNED,  allowNull: false },
  etmc_session: {
    type: DataTypes.ENUM("Q1", "Q2", "Q3", "Q4"),
    allowNull: false,
  },
  meeting_date: { type: DataTypes.DATEONLY, allowNull: true },
  source_document_path: { type: DataTypes.STRING(255), allowNull: true },
  source_document_name: { type: DataTypes.STRING(255), allowNull: true },
  submission_date: { type: DataTypes.DATEONLY, allowNull: true },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false, defaultValue: "draft",
  },
}, {
  tableName: "etmc_tmc_action_point_registers",
  modelName: "EtmcTmcActionPointRegister",
});

module.exports = EtmcTmcActionPointRegister;
