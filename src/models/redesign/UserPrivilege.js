const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const UserPrivilege = sequelize.define(
  "UserPrivilege",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    feature_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "features", key: "id" },
      onDelete: "CASCADE",
    },
    can_view: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    can_create: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    can_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "user_privileges",
    modelName: "UserPrivilege",
    updatedAt: false,
    indexes: [{ unique: true, fields: ["user_id", "feature_id"], name: "uq_user_feature" }],
  },
);

module.exports = UserPrivilege;
