const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Vehicle Maintenance — one report per zone/state/period with payload.rows
 * (one row = one maintenance event).
 */
const VehicleMaintenanceReport = sequelize.define(
  "VehicleMaintenanceReport",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    submission_date: { type: DataTypes.DATEONLY, allowNull: true },
    submitted_by: { type: DataTypes.STRING(100), allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    title: { type: DataTypes.STRING(255), allowNull: true },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      get() {
        const raw = this.getDataValue("payload");
        if (raw == null) return {};
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
          } catch {
            return {};
          }
        }
        return raw;
      },
    },
  },
  {
    tableName: "vehicle_maintenance_reports",
    modelName: "VehicleMaintenanceReport",
    indexes: [
      {
        name: "vmr_scope_idx",
        fields: ["zonal_code", "state_code", "reporting_year", "reporting_month"],
      },
      { name: "vmr_status_idx", fields: ["status"] },
    ],
  },
);

module.exports = VehicleMaintenanceReport;
