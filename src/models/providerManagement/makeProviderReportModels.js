/**
 * Factory: dedicated header + line tables for each Provider Management form.
 * Same shape, separate physical tables — no activity_module filtering.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PROVIDER_STATUSES = [
  "draft",
  "awaiting_review",
  "returned",
  "endorsed",
  "submitted",
  "approved",
];

const LINE_INDICATORS = [
  "accreditation_applications",
  "reaccreditation_applications",
  "completed_forms_returned",
  "awaiting_accreditation",
  "awaiting_reaccreditation",
];

/**
 * @param {object} opts
 * @param {string} opts.modelPrefix   e.g. ProviderAccreditation
 * @param {string} opts.tablePrefix   e.g. provider_accreditation
 * @param {string} opts.refPrefix     e.g. PACC (unused here; used by controller)
 */
function makeProviderReportModels({ modelPrefix, tablePrefix }) {
  const headerTable = `${tablePrefix}_reports`;
  const lineTable = `${tablePrefix}_report_lines`;

  const Report = sequelize.define(
    `${modelPrefix}Report`,
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      zone_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "zonal_offices", key: "id" },
      },
      state_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "state_offices", key: "id" },
      },
      reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
      submission_date: { type: DataTypes.DATEONLY, allowNull: true },
      submitted_by: { type: DataTypes.STRING(100), allowNull: true },
      status: {
        type: DataTypes.ENUM(...PROVIDER_STATUSES),
        allowNull: false,
        defaultValue: "draft",
      },
      planned_activities: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      coordinator_review_note: { type: DataTypes.TEXT, allowNull: true },
      coordinator_reviewed_by: { type: DataTypes.STRING(100), allowNull: true },
      coordinator_reviewed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: headerTable,
      modelName: `${modelPrefix}Report`,
      indexes: [
        {
          unique: true,
          name: `uq_${tablePrefix}_period`,
          fields: ["zone_id", "state_id", "reporting_year", "reporting_month"],
        },
        { name: `idx_${tablePrefix}_status`, fields: ["status"] },
      ],
    },
  );

  const Line = sequelize.define(
    `${modelPrefix}ReportLine`,
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      report_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: headerTable, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      indicator: {
        type: DataTypes.ENUM(...LINE_INDICATORS),
        allowNull: false,
      },
      primary_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      secondary_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      activity_template: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: lineTable, modelName: `${modelPrefix}ReportLine` },
  );

  Report.hasMany(Line, { foreignKey: "report_id", as: "lines", onDelete: "CASCADE" });
  Line.belongsTo(Report, { foreignKey: "report_id", as: "report" });

  return { Report, Line, headerTable, lineTable };
}

module.exports = {
  makeProviderReportModels,
  PROVIDER_STATUSES,
  LINE_INDICATORS,
};
