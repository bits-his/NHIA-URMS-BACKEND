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
];

const StateZonalFocalPerson = sequelize.define(
  "StateZonalFocalPerson",
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
    domain: { type: DataTypes.ENUM(...DOMAINS), allowNull: false },
    officer_name: { type: DataTypes.STRING(150), allowNull: false },
    designation: { type: DataTypes.ENUM(...DESIGNATIONS), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: true },
    phone: { type: DataTypes.STRING(40), allowNull: true },
    created_by: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    tableName: "state_zonal_focal_persons",
    modelName: "StateZonalFocalPerson",
    indexes: [
      {
        unique: true,
        name: "uniq_focal_person_state_year_domain",
        fields: ["state_id", "reporting_year", "domain"],
      },
    ],
  },
);

module.exports = StateZonalFocalPerson;
module.exports.DOMAINS = DOMAINS;
module.exports.DESIGNATIONS = DESIGNATIONS;
