const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Templates 2A / 2B / 2C — one sheet per HMO per period per stream */
const StateOfficeHmoReconSheet = sequelize.define("StateOfficeHmoReconSheet", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  /** phi = 2A, ffs = 2B, cap = 2C */
  stream_type: {
    type: DataTypes.ENUM("phi", "ffs", "cap"),
    allowNull: false,
  },
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
  hmo_name: { type: DataTypes.STRING(255), allowNull: false },
  hmo_code: { type: DataTypes.STRING(80), allowNull: true },
  submitted_by: { type: DataTypes.STRING(100), allowNull: true },
  status: {
    type: DataTypes.ENUM("draft", "submitted", "approved"),
    allowNull: false,
    defaultValue: "draft",
  },
}, { tableName: "state_office_hmo_recon_sheets", modelName: "StateOfficeHmoReconSheet" });

module.exports = StateOfficeHmoReconSheet;
