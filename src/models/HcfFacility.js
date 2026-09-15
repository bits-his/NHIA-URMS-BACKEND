const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * National HCF master list (from NHIA HCF Master Data workbook).
 * One row ≈ facility × service line (as in the Excel sheets).
 */
const HcfFacility = sequelize.define("HcfFacility", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  name: { type: DataTypes.STRING(500), allowNull: false },
  address: { type: DataTypes.STRING(500), allowNull: true },
  address_2: { type: DataTypes.STRING(500), allowNull: true },
  state_name: { type: DataTypes.STRING(120), allowNull: true },
  lga: { type: DataTypes.STRING(150), allowNull: true },
  phone_1: { type: DataTypes.STRING(80), allowNull: true },
  phone_2: { type: DataTypes.STRING(80), allowNull: true },
  facility_type: { type: DataTypes.STRING(40), allowNull: true },
  service_applied_for: { type: DataTypes.STRING(120), allowNull: true },
  contact_person: { type: DataTypes.STRING(200), allowNull: true },
  accreditation_code: { type: DataTypes.STRING(100), allowNull: true },
  facility_code: { type: DataTypes.STRING(100), allowNull: true },
  standby_generator: { type: DataTypes.STRING(40), allowNull: true },
  source_sheet: { type: DataTypes.STRING(80), allowNull: false },
  zone_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  state_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: "hcf_facilities",
  modelName: "HcfFacility",
  indexes: [
    { fields: ["name"] },
    { fields: ["accreditation_code"] },
    { fields: ["state_id"] },
    { fields: ["state_name"] },
    { fields: ["service_applied_for"] },
    { fields: ["source_sheet"] },
    { fields: ["facility_type"] },
  ],
});

module.exports = HcfFacility;
