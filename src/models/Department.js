const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Department = sequelize.define(
  "Department",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    department_code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    /** hq = headquarters departments; state = zone/state unit list. Null = other org records. */
    location_scope: { type: DataTypes.STRING(10), allowNull: true },
  },
  { tableName: "departments", modelName: "Department" }
);

module.exports = Department;
