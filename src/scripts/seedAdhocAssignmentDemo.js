/**
 * Seed script for Ad-hoc / Special Assignment demo data matching the October 2026 Mockup PDF.
 * - Master Assignment: ASG-2026-0048 ("Regional beneficiary sensitisation")
 * - Dispatched to: FCT, KAD, LAG
 * - Kaduna has a submitted report with evidence notes!
 *
 * Run: node src/scripts/seedAdhocAssignmentDemo.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const AdhocMasterAssignment = require("../models/adhoc/AdhocMasterAssignment");
const AdhocStateAssignment = require("../models/adhoc/AdhocStateAssignment");
const AdhocStateReport = require("../models/adhoc/AdhocStateReport");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const masterId = "ASG-2026-0048";

    // 1. Master Assignment
    const [master] = await AdhocMasterAssignment.findOrCreate({
      where: { master_assignment_id: masterId },
      defaults: {
        master_assignment_id: masterId,
        assignment_title: "Regional beneficiary sensitisation",
        originating_department_code: "ISD",
        originating_department_other: null,
        date_received: "2026-11-01",
        priority: "normal",
        reference_memo_number: "NHIA/ISD/2026/048",
        received_through: "official_memo",
        date_on_instruction: "2026-10-30",
        sdo_officer_id: 1,
        sdo_officer_name: "Special Duties Officer",
        assignment_due_date: "2026-11-30",
        assignment_description: "Conduct regional beneficiary sensitisation and desk verification for informal sector coverage across selected pilot states.",
        expected_output: "Comprehensive sensitisation report with signed attendance register, photos of engagement, and summary of challenges.",
        original_instruction_url: "/uploads/adhoc/sample-memo-048.pdf",
        original_instruction_name: "Memo_ISD_Sensitisation_Guidelines_2026.pdf",
        reporting_requirement: "final",
        additional_instructions: "Coordinate closely with the State Ministry of Health and informal trade union leadership.",
        status: "dispatched",
      },
    });
    console.log("✔ Master assignment created/verified:", master.master_assignment_id);

    // 2. Dispatched State Assignments
    const statesData = [
      { code: "FCT", zone: "NC", status: "not_started" },
      { code: "KAD", zone: "NW", status: "completed" },
      { code: "LAG", zone: "SW", status: "in_progress" },
    ];

    for (const item of statesData) {
      const stateAssignmentId = `${masterId}-${item.code}`;
      const [sa] = await AdhocStateAssignment.findOrCreate({
        where: { state_assignment_id: stateAssignmentId },
        defaults: {
          state_assignment_id: stateAssignmentId,
          master_assignment_id: masterId,
          state_code: item.code,
          zonal_code: item.zone,
          state_due_date: "2026-11-30",
          dispatch_date: "2026-11-01",
          dispatch_message: "Please treat with priority and ensure engagement with local artisan associations.",
          copy_zonal_coordinator: true,
          progress_status: item.status,
          closure_status: "open",
        },
      });
      console.log(`✔ State assignment created/verified: ${sa.state_assignment_id}`);

      // Seed report for Kaduna
      if (item.code === "KAD") {
        const [rep] = await AdhocStateReport.findOrCreate({
          where: { state_assignment_id: stateAssignmentId, report_version: 1 },
          defaults: {
            state_assignment_id: stateAssignmentId,
            report_version: 1,
            completion_status: "completed",
            date_completed: "2026-11-15",
            work_summary: "Conducted 3 community sensitisation town-halls in Kaduna North, Zaria, and Kafanchan with informal market associations and artisan unions.",
            output_achieved: "Over 850 market traders sensitised; 320 initial enrollment interest forms collected and validated against NIN.",
            challenges: "Logistical delays during the Kafanchan session due to heavy rainfall; rescheduled meeting hall on short notice.",
            evidence_files: [
              {
                name: "Kaduna_Sensitisation_Attendance_Sheet.pdf",
                path: "/uploads/adhoc/sample-attendance-kad.pdf",
                mime: "application/pdf",
                size: 245000,
                uploaded_at: "2026-11-15T14:30:00.000Z",
              },
              {
                name: "Sensitisation_Photos_Kaduna_North.jpg",
                path: "/uploads/adhoc/sample-photo-kad.jpg",
                mime: "image/jpeg",
                size: 512000,
                uploaded_at: "2026-11-15T14:32:00.000Z",
              },
            ],
            review_status: "submitted",
            submitted_by_name: "Kaduna State Reporting Officer",
            submitted_at: "2026-11-15 15:00:00",
          },
        });
        console.log(`✔ State report created/verified for ${item.code}`);
      }
    }

    console.log("Demo seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
