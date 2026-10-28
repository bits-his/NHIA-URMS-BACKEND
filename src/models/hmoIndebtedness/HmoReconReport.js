const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** Reconciliation sheet — one per state + month + stream + HMO. */
const HmoReconReport = sequelize.define(
  "HmoReconReport",
  {
    reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
    },
    stream_type: {
      type: DataTypes.ENUM("phi", "ffs", "cap"),
      allowNull: false,
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    department_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "departments", key: "department_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: { model: "units", key: "unit_code" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    quarter: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    hmo_name: { type: DataTypes.STRING(255), allowNull: false },
    hmo_code: { type: DataTypes.STRING(80), allowNull: true },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "hmo_recon_reports",
    modelName: "HmoReconReport",
    indexes: [
      {
        unique: true,
        fields: ["state_code", "reporting_year", "reporting_month", "stream_type", "hmo_code"],
        name: "uq_hmo_recon_state_period_stream_hmo",
      },
      {
        fields: ["stream_type", "zonal_code", "state_code", "reporting_year", "reporting_month"],
        name: "idx_hmo_recon_stream_geo_period",
      },
    ],
  },
);

module.exports = HmoReconReport;
