const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Shared shape for rebuilt state-office registers that store the form body in JSON.
 * ICT Support keeps its line items on payload.lines (returned at the top level).
 * Conflict / Infraction and Enrollee Feedback keep the form object on payload.
 */
function definePayloadReport(name, tableName, indexPrefix) {
  return sequelize.define(
    name,
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      reference_id: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      zonal_code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        references: { model: "zonal_offices", key: "zonal_code" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      state_code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        references: { model: "state_offices", key: "code" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      reporting_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      reporting_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
      submission_date: { type: DataTypes.DATEONLY, allowNull: true },
      submitted_by: { type: DataTypes.STRING(100), allowNull: true },
      created_by_user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      status: {
        type: DataTypes.ENUM("draft", "submitted", "approved"),
        allowNull: false,
        defaultValue: "draft",
      },
      title: { type: DataTypes.STRING(255), allowNull: true },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        get() {
          const raw = this.getDataValue("payload");
          if (raw == null) return {};
          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              return parsed && typeof parsed === "object" ? parsed : {};
            } catch {
              return {};
            }
          }
          return raw;
        },
      },
    },
    {
      tableName,
      modelName: name,
      indexes: [
        {
          name: `${indexPrefix}_scope_idx`,
          fields: ["zonal_code", "state_code", "reporting_year", "reporting_month"],
        },
        { name: `${indexPrefix}_status_idx`, fields: ["status"] },
      ],
    },
  );
}

const IctSupportRegisterReport = definePayloadReport(
  "IctSupportRegisterReport",
  "ict_support_register_reports",
  "ict",
);
const ConflictInfractionReport = definePayloadReport(
  "ConflictInfractionReport",
  "conflict_infraction_reports",
  "cif",
);
const EnrolleeFeedbackReport = definePayloadReport(
  "EnrolleeFeedbackReport",
  "enrollee_feedback_reports",
  "efs",
);

module.exports = {
  IctSupportRegisterReport,
  ConflictInfractionReport,
  EnrolleeFeedbackReport,
};
