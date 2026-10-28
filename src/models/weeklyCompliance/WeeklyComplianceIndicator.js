const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Section B/C/D indicator answers for a weekly compliance report.
 * PK (report_reference_id, sn) — no auto-increment id.
 */
const WeeklyComplianceIndicator = sequelize.define(
  "WeeklyComplianceIndicator",
  {
    report_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "weekly_compliance_reports", key: "reference_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sn: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    section_key: { type: DataTypes.STRING(40), allowNull: false },
    indicator_key: { type: DataTypes.STRING(60), allowNull: false },
    answer: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "weekly_compliance_indicators",
    modelName: "WeeklyComplianceIndicator",
    indexes: [
      {
        unique: true,
        fields: ["report_reference_id", "indicator_key"],
        name: "uq_wcr_indicator_key",
      },
    ],
  },
);

module.exports = WeeklyComplianceIndicator;
