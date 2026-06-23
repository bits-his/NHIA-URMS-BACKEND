const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const AnnualReport = require("./AnnualReport");

const QuarterlyData = sequelize.define(
  "QuarterlyData",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    // FK → annual_reports.reference_id
    annual_report_ref: {
      type: DataTypes.STRING(25),
      allowNull: false,
      references: { model: "annual_reports", key: "reference_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    // Category key matches frontend field keys
    // e.g. "gifshipEnrolments", "premiumGIFSHIP", etc.
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    q1: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    q2: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    q3: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    q4: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    sub_total: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "quarterly_data",
    modelName: "QuarterlyData",
  }
);

// ── Associations ──────────────────────────────────────────────────────────────

AnnualReport.hasMany(QuarterlyData, {
  foreignKey: "annual_report_ref",
  sourceKey: "reference_id",
  as: "quarterly_data",
  onDelete: "CASCADE",
});

QuarterlyData.belongsTo(AnnualReport, {
  foreignKey: "annual_report_ref",
  targetKey: "reference_id",
  as: "annual_report",
});

module.exports = QuarterlyData;
