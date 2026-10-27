const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Shared audit trail for dedicated report tables.
 * entity_type = physical table name, e.g. 'provider_accreditation_reports'
 */
const ReportStatusEvent = sequelize.define(
  "ReportStatusEvent",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    entity_type: { type: DataTypes.STRING(80), allowNull: false },
    entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    from_status: { type: DataTypes.STRING(40), allowNull: true },
    to_status: { type: DataTypes.STRING(40), allowNull: false },
    action: { type: DataTypes.STRING(40), allowNull: false },
    actor_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "report_status_events",
    modelName: "ReportStatusEvent",
    updatedAt: false,
    indexes: [{ fields: ["entity_type", "entity_id", "created_at"], name: "idx_rse_entity" }],
  },
);

module.exports = ReportStatusEvent;
