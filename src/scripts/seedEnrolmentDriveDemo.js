/**
 * Seed demo Enrolment Drive rows (single table).
 *   node src/scripts/seedEnrolmentDriveDemo.js
 *   npm run db:seed-enrolment-drive-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const { EnrolmentDriveReport, StateOffice } = require("../models");

async function resetDriveTables() {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.dropTable("enrolment_drive_report_lines");
    console.log("Dropped legacy enrolment_drive_report_lines");
  } catch (_) { /* */ }
  try {
    await qi.dropTable("enrolment_drive_reports");
    console.log("Dropped enrolment_drive_reports for single-table rebuild");
  } catch (_) { /* */ }
}

async function main() {
  await sequelize.authenticate();
  await resetDriveTables();
  console.log("Syncing enrolment drive table…");
  await syncActiveSchema({ alter: true });

  if (!EnrolmentDriveReport) {
    throw new Error("EnrolmentDriveReport not loaded — ensure APPROVED_FORMS['enrolment-drives'] is set");
  }

  const state = await StateOffice.findOne({ order: [["code", "ASC"]] });
  if (!state) throw new Error("No state_offices — seed zones/states first");

  await EnrolmentDriveReport.destroy({
    where: { reference_id: { [Op.like]: "ED%-DEMO-%" } },
  });

  const rows = [
    {
      reference_id: "EDAC-DEMO-00001",
      drive_type: "advocacy",
      drive_code: "E-003",
      activity_category: "Advocacy",
      activity_date: "2026-09-10",
      funding_option: "Budgeted",
      activity_budget: 150000,
      approved_amount: 120000,
      target_audience: ["Community leaders"],
      location_category: "LGA",
      location_name: "Demo LGA",
      programs_supported: ["FSSHIP"],
      planned_target_audience: 50,
      target_audience_reached: 40,
      leads_generated: 12,
      new_enrolments: 8,
      activity_status: "Completed",
    },
    {
      reference_id: "EDCS-DEMO-00001",
      drive_type: "community-sensitization",
      drive_code: "E-001",
      activity_category: "Sensitization",
      activity_date: "2026-09-15",
      funding_option: "Budgeted",
      target_audience: ["Market women", "Youth"],
      programs_supported: ["BHCPF"],
      planned_target_audience: 100,
      target_audience_reached: 85,
      new_enrolments: 20,
      activity_status: "Completed",
    },
    {
      reference_id: "EDMP-DEMO-00001",
      drive_type: "media-parley",
      drive_code: "E-002",
      activity_category: "Media Parley/Campaign",
      activity_date: "2026-09-20",
      funding_option: "Non-budgeted",
      target_audience: ["Media"],
      programs_supported: ["GIFSHIP-G"],
      activity_status: "Completed",
      remarks: "Radio spot + press briefing",
    },
  ];

  for (const row of rows) {
    await EnrolmentDriveReport.create({
      ...row,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: 2026,
      reporting_month: 9,
      submission_date: "2026-09-30",
      submitted_by: "Demo Seed",
      status: "submitted",
      planned_activities: 1,
      quarter: 3,
      supporting_documents: [],
    });
  }

  const count = await EnrolmentDriveReport.count();
  console.log(`Seeded enrolment drive rows: ${count} (state ${state.code})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
