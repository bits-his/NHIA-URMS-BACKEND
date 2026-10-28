const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/** Collation facility rows — alleged CAP / FFS / PHI. */
const HmoIndebtednessLine = sequelize.define(
  "HmoIndebtednessLine",
  {
    report_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "hmo_indebtedness_reports", key: "reference_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sn: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    hmo_name: { type: DataTypes.STRING(255), allowNull: false },
    hmo_code: { type: DataTypes.STRING(80), allowNull: true },
    facility_name: { type: DataTypes.STRING(255), allowNull: false },
    hcf_code: { type: DataTypes.STRING(80), allowNull: true },
    nhia_cap: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    nhia_ffs: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    phi: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "hmo_indebtedness_lines",
    modelName: "HmoIndebtednessLine",
  },
);

module.exports = HmoIndebtednessLine;
