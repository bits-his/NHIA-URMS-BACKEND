const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Outcome items for a stakeholder engagement row.
 * PK (report_reference_id, sn) — no auto-increment id.
 */
const StakeholderOutcome = sequelize.define(
  "StakeholderOutcome",
  {
    report_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "stakeholder_reports", key: "reference_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sn: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    outcome_category: { type: DataTypes.STRING(160), allowNull: true },
    specific_outcome: { type: DataTypes.STRING(200), allowNull: true },
  },
  {
    tableName: "stakeholder_outcomes",
    modelName: "StakeholderOutcome",
  },
);

module.exports = StakeholderOutcome;
