const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** One profile row per state office and reporting year. */
const StateZonalOfficeProfile = sequelize.define(
  "StateZonalOfficeProfile",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "zonal_offices", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    state_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "state_offices", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    staff_strength: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    coordinator_name: { type: DataTypes.STRING(150), allowNull: true },
    coordinator_phone: { type: DataTypes.STRING(40), allowNull: true },
    coordinator_email: { type: DataTypes.STRING(150), allowNull: true },
    office_address: { type: DataTypes.STRING(500), allowNull: true },
    office_email: { type: DataTypes.STRING(150), allowNull: true },
    enrolment_target: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    annual_budget: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    aop_original_name: { type: DataTypes.STRING(255), allowNull: true },
    aop_file_name: { type: DataTypes.STRING(255), allowNull: true },
    aop_file_path: { type: DataTypes.STRING(500), allowNull: true },
    aop_mime: { type: DataTypes.STRING(120), allowNull: true },
    created_by: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    tableName: "state_zonal_office_profiles",
    modelName: "StateZonalOfficeProfile",
    indexes: [
      {
        unique: true,
        name: "uniq_office_profile_state_year",
        fields: ["state_id", "reporting_year"],
      },
    ],
  },
);

module.exports = StateZonalOfficeProfile;
