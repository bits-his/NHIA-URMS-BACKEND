const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DOMAINS = [
  "planning_cell_rep",
  "data_reporting_officer",
  "cemonc",
  "ffp",
  "procurement_officer",
  "actu",
  "servicom",
  "complaint_officer",
  "ict_officer",
  "accounts_finance",
  "store_admin",
  "legal_officer",
  "human_resources",
  "general_services",
];

const DESIGNATIONS = [
  "director",
  "deputy_director",
  "assistant_director",
  "assistant_chief_officer",
  "chief_officer",
  "principal_officer",
  "senior_officer",
  "officer_i",
  "officer_ii",
  "principal_confidential_secretary",
  "senior_confidential_secretary",
  "confidential_secretary",
  "clerical_officer",
];

const StateZonalFocalPerson = sequelize.define(
  "StateZonalFocalPerson",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
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
    domain: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    officer_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
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
    tableName: "state_zonal_focal_persons",
    modelName: "StateZonalFocalPerson",
    indexes: [
      {
        unique: true,
        name: "uniq_focal_person_state_year_domain",
        fields: ["state_code", "reporting_year", "domain"],
      },
      {
        name: "idx_focal_person_zone_year",
        fields: ["zonal_code", "reporting_year"],
      },
    ],
  },
);

module.exports = StateZonalFocalPerson;
module.exports.DOMAINS = DOMAINS;
module.exports.DESIGNATIONS = DESIGNATIONS;
