const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Department = sequelize.define(
  "Department",
  {
    /** Business primary key — no auto-increment id */
    department_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    /** hq = headquarters departments; state = zone/state unit list. Null = other org records. */
    location_scope: { type: DataTypes.STRING(10), allowNull: true },
  },
  { tableName: "departments", modelName: "Department" },
);

module.exports = Department;
