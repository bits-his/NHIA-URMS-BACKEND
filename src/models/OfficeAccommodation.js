const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Dedicated Office Accommodation model (Form 2).
 * Normalizes accommodation data with complete referential integrity.
 */
const OfficeAccommodation = sequelize.define(
  "OfficeAccommodation",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    profile_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "state_zonal_office_profiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    zonal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "zonal_offices", key: "zonal_code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    state_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: { model: "state_offices", key: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    zone_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    state_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    ownership_status: {
      type: DataTypes.ENUM("Rented", "NHIA-owned", "Co-habiting"),
      allowNull: false,
      defaultValue: "Rented",
    },
    rent_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    rent_expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    current_condition: {
      type: DataTypes.ENUM("Good", "Fair", "Poor", "Requires Major Repairs"),
      allowNull: false,
      defaultValue: "Good",
    },
    issue_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved"),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "office_accommodations",
    modelName: "OfficeAccommodation",
    indexes: [
      {
        name: "idx_accommodation_state_year",
        fields: ["state_code", "reporting_year"],
      },
      {
        name: "idx_accommodation_zone_year",
        fields: ["zonal_code", "reporting_year"],
      },
    ],
  },
);

module.exports = OfficeAccommodation;
