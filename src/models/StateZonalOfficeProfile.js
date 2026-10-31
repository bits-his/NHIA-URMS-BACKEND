const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

function parseJsonArray(v) {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function stringifyJsonArray(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? JSON.stringify(parsed) : null;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v)) return null;
  return JSON.stringify(v);
}

/** One profile row per state office and reporting year (Form 1: General Information). */
const StateZonalOfficeProfile = sequelize.define(
  "StateZonalOfficeProfile",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
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

    staff_strength: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    coordinator_name: { type: DataTypes.STRING(150), allowNull: true },
    coordinator_phone: { type: DataTypes.STRING(40), allowNull: true },
    coordinator_email: { type: DataTypes.STRING(150), allowNull: true },
    staff_members: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get() {
        return parseJsonArray(this.getDataValue("staff_members"));
      },
      set(v) {
        this.setDataValue("staff_members", stringifyJsonArray(v));
      },
    },
    office_address: { type: DataTypes.STRING(500), allowNull: true },
    office_email: { type: DataTypes.STRING(150), allowNull: true },
    enrolment_target: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    annual_budget: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    accommodation_entries: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get() {
        return parseJsonArray(this.getDataValue("accommodation_entries"));
      },
      set(v) {
        this.setDataValue("accommodation_entries", stringifyJsonArray(v));
      },
    },
    aop_original_name: { type: DataTypes.STRING(255), allowNull: true },
    aop_file_name: { type: DataTypes.STRING(255), allowNull: true },
    aop_file_path: { type: DataTypes.STRING(500), allowNull: true },
    aop_mime: { type: DataTypes.STRING(120), allowNull: true },

    // Multi-tier workflow status
    status: {
      type: DataTypes.ENUM("draft", "submitted", "endorsed", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    submitted_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
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
    tableName: "state_zonal_office_profiles",
    modelName: "StateZonalOfficeProfile",
    indexes: [
      {
        unique: true,
        name: "uniq_office_profile_state_year",
        fields: ["state_code", "reporting_year"],
      },
      {
        name: "idx_office_profile_zone_year",
        fields: ["zonal_code", "reporting_year"],
      },
    ],
  },
);

module.exports = StateZonalOfficeProfile;
