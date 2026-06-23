const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Role = sequelize.define(
  "Role",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    /** Stored on users.role — e.g. "sdo", "state-officer" */
    key: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(100), allowNull: false },
    staff_id_prefix: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USR" },
    /** Controls monthly report list scoping */
    report_scope: {
      type: DataTypes.ENUM("national", "zonal", "state", "none"),
      allowNull: false,
      defaultValue: "none",
    },
    can_create_monthly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    can_review_monthly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "roles", modelName: "Role" }
);

module.exports = Role;
