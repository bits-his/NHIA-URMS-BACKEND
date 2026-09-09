const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Complaint SLA workspace — one row per priority (Top, High, Medium).
 * Working-day targets from Complaints Register Template.
 */
const ComplaintSlaRule = sequelize.define("ComplaintSlaRule", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  priority: {
    type: DataTypes.ENUM("Top", "High", "Medium"),
    allowNull: false,
    unique: true,
  },
  acknowledge_days: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    comment: "Working days to acknowledge",
  },
  investigation_commence_days: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    comment: "Working days to commence investigation",
  },
  escalate_after_days: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    comment: "Working days before escalation required",
  },
  target_resolution_days: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    comment: "Target resolution in working days",
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: "complaint_sla_rules",
  modelName: "ComplaintSlaRule",
});

module.exports = ComplaintSlaRule;
