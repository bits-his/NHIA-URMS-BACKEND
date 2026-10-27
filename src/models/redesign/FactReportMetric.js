const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const FactReportMetric = sequelize.define(
  "FactReportMetric",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    date_key: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "dim_date", key: "date_key" },
    },
    geo_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "dim_geography", key: "geo_key" },
    },
    form_key: {
      type: DataTypes.STRING(80),
      allowNull: false,
      references: { model: "dim_form", key: "form_key" },
    },
    metric_key: {
      type: DataTypes.STRING(80),
      allowNull: false,
      references: { model: "dim_metric", key: "metric_key" },
    },
    status: { type: DataTypes.STRING(40), allowNull: false },
    submission_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "form_submissions", key: "id" },
      onDelete: "CASCADE",
    },
    line_group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "form_line_groups", key: "id" },
      onDelete: "CASCADE",
    },
    value_number: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
    published_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "fact_report_metrics",
    modelName: "FactReportMetric",
    updatedAt: false,
    createdAt: false,
    indexes: [
      { fields: ["date_key", "geo_key", "metric_key", "status"], name: "idx_fact_slice" },
      { fields: ["form_key", "date_key"], name: "idx_fact_form" },
      { fields: ["submission_id"], name: "idx_fact_sub" },
    ],
  },
);

module.exports = FactReportMetric;
