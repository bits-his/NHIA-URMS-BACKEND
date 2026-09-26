const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AppNotification = sequelize.define("AppNotification", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: true },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: "alert",
  },
  link: { type: DataTypes.STRING(255), allowNull: true },
  entity_type: { type: DataTypes.STRING(80), allowNull: true },
  entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: "app_notifications", modelName: "AppNotification" });

module.exports = AppNotification;
