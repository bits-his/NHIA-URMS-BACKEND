const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Supporting / evidence / report files for a beneficiary activity.
 * Composite PK (report_reference_id, sn) — no auto-increment id.
 */
const BeneficiaryManagementDocument = sequelize.define(
  "BeneficiaryManagementDocument",
  {
    report_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
      references: { model: "beneficiary_management_reports", key: "reference_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sn: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    doc_kind: {
      type: DataTypes.ENUM("supporting", "evidence", "report"),
      allowNull: false,
      defaultValue: "supporting",
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    path: { type: DataTypes.STRING(500), allowNull: false },
    mime: { type: DataTypes.STRING(120), allowNull: true },
  },
  {
    tableName: "beneficiary_management_documents",
    modelName: "BeneficiaryManagementDocument",
  },
);

module.exports = BeneficiaryManagementDocument;
