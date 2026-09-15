const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ExtraDependantReport = require("./ExtraDependantReport");

const ExtraDependantReportLine = sequelize.define("ExtraDependantReportLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "extra_dependant_reports", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  enrollee_name: { type: DataTypes.STRING(150), allowNull: false },
  principle_nhia_number: { type: DataTypes.STRING(50), allowNull: false },
  age: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
  relationship: { type: DataTypes.STRING(40), allowNull: false },
  program: { type: DataTypes.STRING(80), allowNull: true },
  request_date: { type: DataTypes.DATEONLY, allowNull: true },
  process_end_date: { type: DataTypes.DATEONLY, allowNull: true },
  line_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
  supporting_documents: {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const raw = this.getDataValue("supporting_documents");
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    },
  },
}, { tableName: "extra_dependant_report_lines", modelName: "ExtraDependantReportLine" });

ExtraDependantReport.hasMany(ExtraDependantReportLine, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
ExtraDependantReportLine.belongsTo(ExtraDependantReport, { foreignKey: "report_id", as: "report" });

module.exports = ExtraDependantReportLine;
