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
    // Already serialized — keep as-is if valid array JSON, else wrap parse attempt
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

/** One profile row per state office and reporting year. */
const StateZonalOfficeProfile = sequelize.define(
  "StateZonalOfficeProfile",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "zonal_offices", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "state_offices", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
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
    created_by: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    tableName: "state_zonal_office_profiles",
    modelName: "StateZonalOfficeProfile",
    indexes: [
      {
        unique: true,
        name: "uniq_office_profile_state_year",
        fields: ["state_id", "reporting_year"],
      },
    ],
  },
);

module.exports = StateZonalOfficeProfile;
