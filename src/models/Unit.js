const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Unit = sequelize.define(
  "Unit",
  {
    /** Business primary key — no auto-increment id */
    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    /** division = HQ division under a department; state_unit = zone/state unit. */
    location_role: { type: DataTypes.STRING(12), allowNull: true },
    department_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "departments", key: "department_code" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  },
  { tableName: "units", modelName: "Unit" },
);

module.exports = Unit;
