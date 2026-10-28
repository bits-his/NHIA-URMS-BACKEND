const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * Shared file attachments for all approved form packs.
 * PK (form_key, report_reference_id, sn) — no auto-increment id.
 */
const FormDocument = sequelize.define(
  "FormDocument",
  {
    form_key: {
      type: DataTypes.STRING(40),
      allowNull: false,
      primaryKey: true,
    },
    report_reference_id: {
      type: DataTypes.STRING(30),
      allowNull: false,
      primaryKey: true,
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
    tableName: "form_documents",
    modelName: "FormDocument",
    indexes: [
      { fields: ["form_key", "report_reference_id"], name: "idx_form_documents_parent" },
    ],
  },
);

module.exports = FormDocument;
