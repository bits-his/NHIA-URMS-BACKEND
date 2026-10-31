const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Utility Service Reports (Form 3).
 * Supports Generator Servicing (bi-annual / 2x per year) and
 * Security & Cleaning Services (monthly state submission -> zonal consolidation to HQ).
 */
const UtilityServiceReport = sequelize.define(
  "UtilityServiceReport",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reference_id: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    profile_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "state_zonal_office_profiles", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    zone_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    state_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },

    service_category: {
      type: DataTypes.ENUM("generator", "security", "cleaning", "other"),
      allowNull: false,
      defaultValue: "generator",
    },
    frequency: {
      type: DataTypes.ENUM("biannual", "monthly", "quarterly", "ad_hoc"),
      allowNull: false,
      defaultValue: "monthly",
    },
    cycle: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true,
      comment: "Cycle 1 or 2 for bi-annual generator servicing",
    },

    contractor_name: { type: DataTypes.STRING(200), allowNull: false },
    contractor_phone: { type: DataTypes.STRING(50), allowNull: true },
    contractor_email: { type: DataTypes.STRING(150), allowNull: true },
    invoice_number: { type: DataTypes.STRING(100), allowNull: true },

    amount_claimed: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    amount_approved: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },

    service_description: { type: DataTypes.TEXT, allowNull: true },

    // 3 Mandatory upload bundle for payment clearance
    job_completion_cert_path: { type: DataTypes.STRING(500), allowNull: true },
    job_completion_cert_name: { type: DataTypes.STRING(255), allowNull: true },
    invoice_path: { type: DataTypes.STRING(500), allowNull: true },
    invoice_name: { type: DataTypes.STRING(255), allowNull: true },
    contractor_letter_path: { type: DataTypes.STRING(500), allowNull: true },
    contractor_letter_name: { type: DataTypes.STRING(255), allowNull: true },

    additional_attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("additional_attachments");
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
          try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        }
        return [];
      },
    },

    status: {
      type: DataTypes.ENUM("draft", "submitted", "endorsed", "consolidated", "approved", "returned"),
      allowNull: false,
      defaultValue: "draft",
    },
    consolidated_batch_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Zonal consolidation batch ID grouping states for single HQ payment request",
    },

    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
    coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
    coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },

    created_by: { type: DataTypes.STRING(100), allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "utility_service_reports",
    modelName: "UtilityServiceReport",
    indexes: [
      {
        name: "idx_utility_state_period",
        fields: ["state_code", "reporting_year", "service_category"],
      },
      {
        name: "idx_utility_zone_year",
        fields: ["zonal_code", "reporting_year"],
      },
      {
        name: "idx_utility_consolidation",
        fields: ["consolidated_batch_id"],
      },
    ],
  },
);

module.exports = UtilityServiceReport;
