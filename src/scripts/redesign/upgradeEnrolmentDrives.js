require("dotenv").config();
const sequelize = require("../../config/database");
const models = require("../../models");
const workflow = require("../../models/enrolment/EnrolmentDriveWorkflow");

async function upgrade() {
  const qi = sequelize.getQueryInterface();
  await sequelize.authenticate();
  await workflow.EnrolmentDriveBatch.sync();
  await models.EnrolmentDriveReport.sync();
  await models.EnrolmentReport.sync();
  for (const [Model, columns] of [
    [models.EnrolmentDriveReport, ["batch_reference_id", "exact_location", "evidence_type", "status_reason", "other_audience", "revision"]],
    [models.EnrolmentReport, ["drive_reference_id", "drive_enrolment_mode"]],
  ]) {
    const existing = await qi.describeTable(Model.tableName);
    for (const column of columns) {
      if (existing[column]) continue;
      const attr = Model.rawAttributes[column];
      await qi.addColumn(Model.tableName, column, { type: attr.type, allowNull: attr.allowNull, defaultValue: attr.defaultValue, references: attr.references, onDelete: attr.onDelete });
      console.log(`Added ${Model.tableName}.${column}`);
    }
  }
  for (const Model of [workflow.EnrolmentDriveProgramme, workflow.EnrolmentDriveAudience, workflow.EnrolmentDriveReview, workflow.EnrolmentDriveAction, workflow.EnrolmentDriveEvidence]) await Model.sync();
  const indexes = await qi.showIndex(models.EnrolmentReport.tableName);
  if (!indexes.some((index) => index.name === "idx_enrolment_originating_drive")) await qi.addIndex(models.EnrolmentReport.tableName, ["drive_reference_id"], { name: "idx_enrolment_originating_drive" });
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_activity_facts_v AS
    SELECT d.reference_id AS drive_id, d.batch_reference_id AS batch_id, d.state_code, d.zonal_code,
      d.reporting_year, d.reporting_month, d.drive_type, d.activity_category, d.activity_date, d.activity_status,
      d.target_audience_reached, d.leads_generated, d.funding_option, d.activity_budget, d.approved_amount,
      COALESCE(e.enrolled, 0) AS linked_enrolments, COALESCE(e.records, 0) AS linked_records,
      d.new_enrolments AS legacy_reported_enrolments, b.status AS reporting_status
    FROM enrolment_drive_reports d LEFT JOIN enrolment_drive_batches b ON b.reference_id = d.batch_reference_id
    LEFT JOIN (SELECT drive_reference_id, SUM(enrolment_count) AS enrolled, COUNT(*) AS records
      FROM enrolment_reports WHERE category = 'enrolment' AND drive_reference_id IS NOT NULL GROUP BY drive_reference_id) e
      ON e.drive_reference_id = d.reference_id`);
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_batch_facts_v AS
    SELECT b.reference_id AS batch_id, b.state_code, b.zonal_code, b.reporting_year, b.reporting_month,
      b.planned_activities, b.status, b.submitted_at, b.finalised_at, b.reporting_deadline,
      COALESCE(d.recorded, 0) AS activities_recorded, COALESCE(d.conducted, 0) AS activities_conducted
    FROM enrolment_drive_batches b LEFT JOIN
      (SELECT batch_reference_id, COUNT(*) AS recorded, SUM(activity_status = 'Completed') AS conducted
      FROM enrolment_drive_reports GROUP BY batch_reference_id) d ON d.batch_reference_id = b.reference_id`);
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_programme_selections_v AS
    SELECT p.drive_reference_id AS drive_id, p.programme, d.state_code, d.zonal_code
    FROM enrolment_drive_programmes p JOIN enrolment_drive_reports d ON d.reference_id = p.drive_reference_id`);
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_audience_selections_v AS
    SELECT a.drive_reference_id AS drive_id, a.audience, d.state_code, d.zonal_code
    FROM enrolment_drive_audiences a JOIN enrolment_drive_reports d ON d.reference_id = a.drive_reference_id`);
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_enrolment_period_facts_v AS
    SELECT state_code, zonal_code, reporting_year, reporting_month, enrolment_type,
      COUNT(*) AS enrolment_records, SUM(enrolment_count) AS enrolled
    FROM enrolment_reports WHERE category = 'enrolment' AND drive_reference_id IS NOT NULL
    GROUP BY state_code, zonal_code, reporting_year, reporting_month, enrolment_type`);
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_actions_facts_v AS
    SELECT a.reference_id AS issue_id, a.state_code, a.zonal_code, a.reporting_year, a.reporting_month,
      a.source_dashboard, a.issue, a.agreed_action, a.accountable_owner, a.deadline, a.status,
      a.outcome, a.closure_date, COALESCE(e.files, 0) AS evidence_files
    FROM enrolment_drive_actions a LEFT JOIN
      (SELECT action_reference_id, COUNT(*) AS files FROM enrolment_drive_evidence
      WHERE action_reference_id IS NOT NULL GROUP BY action_reference_id) e ON e.action_reference_id = a.reference_id`);
  const nationalRoles = ["admin", "sdo", "dg-ceo", "hq-department"].map((role) => sequelize.escape(role)).join(",");
  const grants = ["enrolment drives", "enrolment-drive", ...require("../../utils/enrolmentDriveTypes").ENROLMENT_DRIVE_TYPES.map((type) => type.title.toLowerCase())]
    .map((grant) => `LOCATE(${sequelize.escape(grant)}, COALESCE(LOWER(CAST(u.functionalities AS CHAR)), '')) > 0`).join(" OR ");
  await sequelize.query(`CREATE OR REPLACE VIEW enrolment_drive_access_v AS
    SELECT u.id AS user_id, LOWER(u.email) AS principal, s.code AS state_code, s.zonal_code
    FROM users u JOIN state_offices s ON
      u.role IN (${nationalRoles}) OR
      (u.role LIKE '%zonal%' AND u.zonal_code = s.zonal_code) OR
      (u.role NOT LIKE '%zonal%' AND (NULLIF(u.state_code, '') = s.code OR
        (NULLIF(u.state_code, '') IS NULL AND u.zonal_code = s.zonal_code)))
    WHERE u.is_active = 1 AND NULLIF(u.email, '') IS NOT NULL
      AND (u.role IN (${nationalRoles}) OR ${grants})`);
  console.log("Enrolment Drives upgraded additively. Historical rows and manually reported counts were preserved; attach historical activities explicitly in the register.");
}

if (require.main === module) upgrade().then(() => sequelize.close()).catch(async (error) => { console.error(error.message); await sequelize.close(); process.exitCode = 1; });
module.exports = upgrade;
