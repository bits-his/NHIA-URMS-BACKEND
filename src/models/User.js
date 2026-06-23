const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    staff_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(150), allowNull: true, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    /** Role key — references roles.key */
    role: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "state-officer" },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "zonal_offices", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "state_offices", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    department_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "departments", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    unit_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "units", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    functionalities: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array of {access_to, functionalities[]} objects",
    },
  },
  { tableName: "users", modelName: "User" }
);

module.exports = { User };
