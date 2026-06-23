const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AnnualReport = sequelize.define(
  "AnnualReport",
  {
    // ── Primary Key: human-readable reference ID ─────────────────────────────
    // Format: NHIA-AR-{YEAR}-{00001}  (sequence resets per year)
    reference_id: {
      type: DataTypes.STRING(25),
      primaryKey: true,
      allowNull: false,
    },
    // ── General Information ──────────────────────────────────────────────────
    reporting_year: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    staff_no: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    total_vehicles: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    total_hcf_under_nhia: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    total_accredited_hcf: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    approved_budget: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    total_amount_utilized: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    // ── CEmONC ───────────────────────────────────────────────────────────────
    total_accredited_cemonc: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    total_cemonc_beneficiaries: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    // ── FFP ──────────────────────────────────────────────────────────────────
    total_accredited_ffp: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    total_ffp_beneficiaries: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    // ── Meta ─────────────────────────────────────────────────────────────────
    status: {
      type: DataTypes.ENUM("draft", "submitted", "under_review", "zonal_review", "approved", "rejected"),
      allowNull: false,
      defaultValue: "draft",
    },
    submitted_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // ── Approval chain audit ──────────────────────────────────────────────────
    state_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    state_reviewed_at: { type: DataTypes.DATE,        allowNull: true },
    state_review_note: { type: DataTypes.TEXT,        allowNull: true },
    zonal_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    zonal_reviewed_at: { type: DataTypes.DATE,        allowNull: true },
    zonal_review_note: { type: DataTypes.TEXT,        allowNull: true },
    sdo_reviewed_by:   { type: DataTypes.STRING(100), allowNull: true },
    sdo_reviewed_at:   { type: DataTypes.DATE,        allowNull: true },
    sdo_review_note:   { type: DataTypes.TEXT,        allowNull: true },
    rejection_reason:  { type: DataTypes.TEXT,        allowNull: true },
    rejected_by:       { type: DataTypes.STRING(100), allowNull: true },
    rejected_at:       { type: DataTypes.DATE,        allowNull: true },
  },
  {
    tableName: "annual_reports",
    modelName: "AnnualReport",
  }
);

module.exports = AnnualReport;
