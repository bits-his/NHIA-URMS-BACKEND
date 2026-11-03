/**
 * Seed script for Ad-hoc / Special Assignment demo data matching the October 2026 Mockup PDF.
 * Generates 3 realistic assignments covering the full lifecycle:
 *
 * 1. ASG-2026-0048 — Dispatched & Active:
 *    - Recipient States: Kaduna (Completed & Accepted), Lagos (In Progress & Under Review), FCT (Awaiting Support & Clarification).
 * 2. ASG-2026-0049 — Draft Directive:
 *    - Fresh directive from SQA ready for SDO to test State Distribution / Dispatch.
 * 3. ASG-2026-0050 — Closed Assignment:
 *    - Fully completed and formally closed national audit with closure remarks across Kano, Rivers, Enugu.
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

    const validInstructionPdf = "/uploads/adhoc/1793705413879-Adhoc_Assignment_Forms.pptx.pdf";

    // ───────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT 1: ASG-2026-0048 (Dispatched & Multi-State Active)
    // ───────────────────────────────────────────────────────────────────────────
    const id1 = "ASG-2026-0048";
    const [m1] = await AdhocMasterAssignment.upsert({
      master_assignment_id: id1,
      assignment_title: "Regional Beneficiary Sensitisation & Desk Verification",
      originating_department_code: "ISD",
      originating_department_other: null,
      date_received: "2026-11-01",
      priority: "high",
      reference_memo_number: "NHIA/ISD/2026/048",
      received_through: "official_memo",
      date_on_instruction: "2026-10-30",
      sdo_officer_id: 1,
      sdo_officer_name: "Special Duties Officer",
      assignment_due_date: "2026-11-30",
      assignment_description:
        "Conduct regional beneficiary sensitisation and desk verification for informal sector coverage across selected pilot states.",
      expected_output:
        "Comprehensive sensitisation report with signed attendance register, photos of engagement, and summary of challenges.",
      original_instruction_url: validInstructionPdf,
      original_instruction_name: "Memo_ISD_Sensitisation_Guidelines_2026.pdf",
      reporting_requirement: "final",
      additional_instructions:
        "Coordinate closely with the State Ministry of Health and informal trade union leadership.",
      status: "dispatched",
      created_by_user_id: 1,
    });
    console.log("✔ Master Assignment 1 created/updated:", id1);

    // Kaduna (Completed & Accepted)
    const kadId = `${id1}-KAD`;
    await AdhocStateAssignment.upsert({
      state_assignment_id: kadId,
      master_assignment_id: id1,
      state_code: "KAD",
      zonal_code: "NW",
      state_due_date: "2026-11-30",
      dispatch_date: "2026-11-01",
      dispatch_message: "Please treat with priority and ensure engagement with local artisan associations.",
      copy_zonal_coordinator: true,
      progress_status: "completed",
      closure_status: "open",
    });
    await AdhocStateReport.findOrCreate({
      where: { state_assignment_id: kadId, report_version: 1 },
      defaults: {
        state_assignment_id: kadId,
        report_version: 1,
        completion_status: "completed",
        date_completed: "2026-11-15",
        work_summary:
          "Conducted 3 community sensitisation town-halls in Kaduna North, Zaria, and Kafanchan with informal market associations and artisan unions.",
        output_achieved:
          "Over 850 market traders sensitised; 320 initial enrollment interest forms collected and validated against NIN.",
        challenges:
          "Logistical delays during the Kafanchan session due to heavy rainfall; rescheduled meeting hall on short notice.",
        evidence_files: [
          {
            name: "Kaduna_Sensitisation_Attendance_Sheet.pdf",
            path: validInstructionPdf,
            mime: "application/pdf",
            size: 245000,
            uploaded_at: "2026-11-15T14:30:00.000Z",
          },
        ],
        review_status: "accepted",
        submitted_by_name: "Kaduna State Reporting Officer",
        submitted_at: new Date("2026-11-15T15:00:00.000Z"),
        reviewed_by_name: "National SDO",
        reviewed_at: new Date("2026-11-16T09:30:00.000Z"),
      },
    });

    // Lagos (In Progress & Under Review)
    const lagId = `${id1}-LAG`;
    await AdhocStateAssignment.upsert({
      state_assignment_id: lagId,
      master_assignment_id: id1,
      state_code: "LAG",
      zonal_code: "SW",
      state_due_date: "2026-11-30",
      dispatch_date: "2026-11-01",
      dispatch_message: "Engage trade leaders in Alaba, Ikeja and Trade Fair complexes.",
      copy_zonal_coordinator: true,
      progress_status: "in_progress",
      closure_status: "open",
    });
    await AdhocStateReport.findOrCreate({
      where: { state_assignment_id: lagId, report_version: 1 },
      defaults: {
        state_assignment_id: lagId,
        report_version: 1,
        completion_status: "partially_completed",
        date_completed: null,
        work_summary:
          "Organised preliminary briefing sessions with the Lagos State Market Women Association and Road Transport Workers Union in Ikeja and Oshodi.",
        output_achieved:
          "450 preliminary enrollees screened; biometric capture desks deployed in 2 major general hospitals.",
        challenges:
          "Heavy morning traffic congestion delayed mobile equipment setup at Oshodi station.",
        evidence_files: [
          {
            name: "Lagos_Interim_Sensitisation_Summary.pdf",
            path: validInstructionPdf,
            mime: "application/pdf",
            size: 184000,
            uploaded_at: "2026-11-18T11:00:00.000Z",
          },
        ],
        review_status: "under_review",
        submitted_by_name: "Lagos State Reporting Officer",
        submitted_at: new Date("2026-11-18T11:15:00.000Z"),
      },
    });

    // FCT (Awaiting Support & Clarification note)
    const fctId = `${id1}-FCT`;
    await AdhocStateAssignment.upsert({
      state_assignment_id: fctId,
      master_assignment_id: id1,
      state_code: "FCT",
      zonal_code: "NC",
      state_due_date: "2026-11-30",
      dispatch_date: "2026-11-01",
      dispatch_message: "Priority assignment for Abuja area councils.",
      copy_zonal_coordinator: true,
      progress_status: "awaiting_support",
      closure_status: "open",
    });
    await AdhocStateReport.findOrCreate({
      where: { state_assignment_id: fctId, report_version: 1 },
      defaults: {
        state_assignment_id: fctId,
        report_version: 1,
        completion_status: "ongoing",
        date_completed: null,
        work_summary: "Initial sensitisation meetings held in Bwari and Gwagwalada council headquarters.",
        output_achieved: "Met with 14 artisan union heads; 410 prospective enrollees engaged.",
        challenges: "Required official endorsement letter from Area Council Secretariat before venue entry.",
        evidence_files: [
          {
            name: "FCT_Initial_Engagement_Notes.pdf",
            path: validInstructionPdf,
            mime: "application/pdf",
            size: 142000,
            uploaded_at: "2026-11-10T09:00:00.000Z",
          },
        ],
        review_status: "returned_for_clarification",
        clarification_note:
          "Please attach the signed attendance sheets from the Bwari meeting and include validated NIN roster before final approval.",
        submitted_by_name: "FCT State Reporting Officer",
        submitted_at: new Date("2026-11-10T09:20:00.000Z"),
        reviewed_by_name: "National SDO",
        reviewed_at: new Date("2026-11-12T14:00:00.000Z"),
      },
    });
    console.log("✔ State Assignments seeded for:", id1);

    // ───────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT 2: ASG-2026-0049 (Draft Directive — Ready to Dispatch)
    // ───────────────────────────────────────────────────────────────────────────
    const id2 = "ASG-2026-0049";
    await AdhocMasterAssignment.upsert({
      master_assignment_id: id2,
      assignment_title: "Emergency Healthcare Facility Spot Check on Essential Drug Stocks",
      originating_department_code: "SQA",
      originating_department_other: null,
      date_received: "2026-11-02",
      priority: "urgent",
      reference_memo_number: "NHIA/SQA/2026/MEMO-089",
      received_through: "official_memo",
      date_on_instruction: "2026-11-02",
      sdo_officer_id: 1,
      sdo_officer_name: "Special Duties Officer",
      assignment_due_date: "2026-12-15",
      assignment_description:
        "Conduct unannounced spot checks across accredited secondary hospitals regarding reported prescription drug stockouts and out-of-pocket charges to enrollees under the NHIA benefit package.",
      expected_output:
        "Completed pharmacy inventory reconciliation sheets, enrollee exit interview forms, and facility infraction notices issued.",
      original_instruction_url: validInstructionPdf,
      original_instruction_name: "SQA_Emergency_Spot_Check_Circular_2026.pdf",
      reporting_requirement: "final",
      additional_instructions:
        "Inspect hospital pharmacy dispensing registers and verify stock bin cards against NHIA medicines price list.",
      status: "draft",
      created_by_user_id: 1,
    });
    console.log("✔ Master Assignment 2 created (Draft):", id2);

    // ───────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT 3: ASG-2026-0050 (Formally Closed National Audit)
    // ───────────────────────────────────────────────────────────────────────────
    const id3 = "ASG-2026-0050";
    await AdhocMasterAssignment.upsert({
      master_assignment_id: id3,
      assignment_title: "Nationwide Ministerial Audit of Primary Healthcare Enrollee Registers",
      originating_department_code: "ED",
      originating_department_other: null,
      date_received: "2026-10-01",
      priority: "normal",
      reference_memo_number: "NHIA/DG/ED/2026/012",
      received_through: "circular",
      date_on_instruction: "2026-09-28",
      sdo_officer_id: 1,
      sdo_officer_name: "Special Duties Officer",
      assignment_due_date: "2026-10-31",
      assignment_description:
        "Verify physical enrollee register compliance in primary healthcare centres against the NHIA central capitation allocation database.",
      expected_output:
        "Reconciled capitation register certified by State Primary Health Care Development Agency (SPHCDA) and State Coordinator.",
      original_instruction_url: validInstructionPdf,
      original_instruction_name: "Ministerial_Audit_Directive_ED_2026.pdf",
      reporting_requirement: "final",
      additional_instructions:
        "Ensure SPHCDA executive secretary co-signs the reconciliation summary sheet.",
      status: "closed",
      created_by_user_id: 1,
    });

    const closedStates = [
      { code: "KAN", zone: "NW", name: "Kano", repDate: "2026-10-25" },
      { code: "RIV", zone: "SS", name: "Rivers", repDate: "2026-10-26" },
      { code: "ENU", zone: "SE", name: "Enugu", repDate: "2026-10-28" },
    ];

    for (const st of closedStates) {
      const saId = `${id3}-${st.code}`;
      await AdhocStateAssignment.upsert({
        state_assignment_id: saId,
        master_assignment_id: id3,
        state_code: st.code,
        zonal_code: st.zone,
        state_due_date: "2026-10-31",
        dispatch_date: "2026-10-01",
        dispatch_message: `Conduct PHC register audit across all designated facilities in ${st.name}.`,
        copy_zonal_coordinator: true,
        progress_status: "completed",
        closure_status: "closed",
        closed_at: new Date("2026-10-30T16:00:00.000Z"),
        closed_by: 1,
        closed_by_name: "Special Duties Officer",
        closure_remarks: `Audit deliverables for ${st.name} State verified and reconciled with national capitation database.`,
      });

      await AdhocStateReport.findOrCreate({
        where: { state_assignment_id: saId, report_version: 1 },
        defaults: {
          state_assignment_id: saId,
          report_version: 1,
          completion_status: "completed",
          date_completed: st.repDate,
          work_summary: `Completed thorough verification of 120 primary healthcare facility registers across ${st.name} State.`,
          output_achieved:
            "Reconciled 14,800 active enrollee identities against capitation roster; identified 112 uncollected cards.",
          challenges: "Remote rural PHC access required boat transport in riverine communities.",
          evidence_files: [
            {
              name: `${st.name}_PHC_Audit_Certification.pdf`,
              path: validInstructionPdf,
              mime: "application/pdf",
              size: 320000,
              uploaded_at: `${st.repDate}T14:00:00.000Z`,
            },
          ],
          review_status: "accepted",
          submitted_by_name: `${st.name} State Reporting Officer`,
          submitted_at: new Date(`${st.repDate}T14:30:00.000Z`),
          reviewed_by_name: "National SDO",
          reviewed_at: new Date("2026-10-30T10:00:00.000Z"),
        },
      });
    }
    console.log("✔ Master Assignment 3 created & closed:", id3);

    console.log("\n========================================================");
    console.log("🎉 All 3 Ad-hoc / Special Assignment demo records seeded!");
    console.log("   1. ASG-2026-0048 (Dispatched • Active in KAD, LAG, FCT)");
    console.log("   2. ASG-2026-0049 (Draft • Ready for SDO Dispatch testing)");
    console.log("   3. ASG-2026-0050 (Closed • Formally completed audit in KAN, RIV, ENU)");
    console.log("========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
