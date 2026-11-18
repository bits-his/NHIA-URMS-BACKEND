/**
 * Demo rows for:
 *   - Meetings & Coordination (meeting reports + ETMC)
 *   - Vehicle Maintenance
 *   - ICT Support Register
 *   - Conflict / Infraction (with resolution fields)
 *   - Enrollee Feedback Survey
 *
 *   node src/scripts/seedOfficeRegistersDemo.js
 *   npm run db:seed-office-registers
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  StateOffice,
  MeetingReport,
  MeetingItem,
  EtmcReport,
  EtmcEntry,
  VehicleMaintenanceReport,
  IctSupportRegisterReport,
  ConflictInfractionReport,
  EnrolleeFeedbackReport,
} = require("../models");

const YEAR = 2026;

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function dateInMonth(year, month, day) {
  const d = Math.min(28, Math.max(1, day));
  return `${year}-${pad(month)}-${pad(d)}`;
}

const STATUSES = ["draft", "submitted", "submitted", "submitted", "draft"];

const MEETING_TYPES = [
  "Management Meeting",
  "Staff Meeting",
  "Technical Meeting",
  "Stakeholder Meeting",
  "Other",
];

const ETMC_SESSIONS = ["Q1", "Q1", "Q2", "Q2", "Q3"];

function vehiclePayload(i) {
  const maintenanceDate = dateInMonth(YEAR, i + 1, 8);
  return {
    rows: [
      {
        vehicleModel: ["Toyota Hilux", "Nissan Patrol", "Toyota Corolla", "Ford Ranger", "Honda Accord"][i],
        chassisNumber: `CHASSIS-SEED-${100 + i}`,
        maintenanceType: i % 2 === 0 ? "Preventive Maintenance" : "Emergency Repair",
        problemReported: ["Routine service", "Battery failure", "Brake pads", "AC compressor", "Tyre replacement"][i],
        maintenanceDate,
        nextServiceDate: dateInMonth(YEAR, Math.min(i + 2, 12), 8),
        vehicleStatus: i === 3 ? "Restricted Use" : "Operational",
        remarks: "Seed sample maintenance entry",
      },
    ],
  };
}

function ictLine(i, month) {
  const helpdesk = i % 2 === 0;
  return {
    support_id: `SUP-${pad(i + 1, 4)}`,
    date_reported: dateInMonth(YEAR, month, 3 + i),
    reported_by: ["ICT Desk", "Admin Officer", "Front Desk", "Store Officer", "Enrolment Desk"][i],
    support_category: helpdesk ? "helpdesk" : "network_infrastructure",
    issue_type: helpdesk ? "login_password" : "internet_connectivity",
    description: `Seed ICT support request ${i + 1}`,
    priority: ["low", "medium", "high", "critical", "medium"][i],
    date_resolved: i % 2 === 0 ? dateInMonth(YEAR, month, 6 + i) : null,
    resolution_status: i % 2 === 0 ? "resolved" : "open",
    action_taken: "Logged and assigned to the ICT desk",
    external_support_required: helpdesk ? "no" : "yes",
    referred_to: helpdesk ? "State ICT" : "HQ ICT",
    remarks: "Seed sample",
  };
}

function conflictPayload(label, i, month) {
  const resolved = i % 2 === 0;
  return {
    refNo: `CIF-SEED-${pad(i + 1, 3)}`,
    dateOfReport: dateInMonth(YEAR, month, 4 + i),
    reportingOfficer: ["L. Ade", "M. Bassey", "N. Garba", "O. Uche", "P. Sule"][i],
    officeLocation: `${label} State Office`,
    staff1: "Officer A",
    staff2: "Officer B",
    incidentDate: dateInMonth(YEAR, month, 2 + i),
    location: "Admin block",
    natures: [["Insubordination"], ["Misconduct / Ethical Breach"], ["Resource / Budget-line Dispute"], ["Interpersonal / Personality Conflict"], ["Other"]][i],
    otherSpecify: i === 4 ? "Work schedule disagreement" : "",
    description: `Sample conflict report ${i + 1} for ${label}`,
    immediateAction: "Parties counselled separately",
    recommendedResolution: "Mediation meeting with HOD",
    resolutionStatus: resolved ? "Resolved" : "Pending",
    resolutionDate: resolved ? dateInMonth(YEAR, month, 18 + i) : null,
    resolutionOutcome: resolved
      ? "Parties reconciled; workplan agreed and signed"
      : "Awaiting zonal mediation",
    escalatedTo: "Zonal Coordinator",
    dateEscalated: dateInMonth(YEAR, month, 5 + i),
    expectedResponseDate: dateInMonth(YEAR, month, 12 + i),
    preparedBy: "Admin Desk",
    designation: "State Admin Officer",
    preparedDate: dateInMonth(YEAR, month, 5 + i),
    endorsedBy: "State Coordinator",
  };
}

function feedbackPayload(i, month) {
  return {
    hearAbout: [["Radio"], ["Office staff"], ["Social media"], ["Provider (HCP/HMO)"], ["Friend / family"]][i],
    hearOther: "",
    visitPurpose: [["New enrolment / Registration"], ["ID Card Issuance / Replacement"], ["Renewal"], ["Inquiry / Information Request"], ["Complaint / Grievance"]][i],
    purposeOther: "",
    ratings: {
      "Waiting Time": ["Fair", "Acceptable", "Excellent", "Acceptable", "Poor"][i],
      "Staff Courtesy": ["Excellent", "Excellent", "Acceptable", "Fair", "Acceptable"][i],
      "Clarity of Information": ["Acceptable", "Excellent", "Fair", "Acceptable", "Acceptable"][i],
      "Overall Satisfaction": ["Acceptable", "Excellent", "Acceptable", "Fair", "Poor"][i],
    },
    resolvedToday: ["Yes", "Yes", "Partially", "Yes", "No"][i],
    comments: "Seed sample enrollee feedback",
    preparedBy: "Front Desk",
    preparedDate: dateInMonth(YEAR, month, 6 + i),
  };
}

async function clearSeed(Model, field, prefix) {
  if (!Model) return;
  await Model.destroy({ where: { [field]: { [Op.like]: `${prefix}%` } } });
}

async function main() {
  await sequelize.authenticate();
  console.log("✅  DB connected");

  const missing = [
    ["MeetingReport", MeetingReport],
    ["MeetingItem", MeetingItem],
    ["EtmcReport", EtmcReport],
    ["EtmcEntry", EtmcEntry],
    ["VehicleMaintenanceReport", VehicleMaintenanceReport],
    ["IctSupportRegisterReport", IctSupportRegisterReport],
    ["ConflictInfractionReport", ConflictInfractionReport],
    ["EnrolleeFeedbackReport", EnrolleeFeedbackReport],
  ].filter(([, model]) => !model);
  if (missing.length) {
    throw new Error(`Models not loaded: ${missing.map(([name]) => name).join(", ")}. Approve the forms in activeSchema first.`);
  }

  await VehicleMaintenanceReport.sync();
  await IctSupportRegisterReport.sync();
  await ConflictInfractionReport.sync();
  await EnrolleeFeedbackReport.sync();
  await MeetingReport.sync();
  await MeetingItem.sync();
  await EtmcReport.sync();
  await EtmcEntry.sync();

  const states = await StateOffice.findAll({
    attributes: ["code", "description", "zonal_code"],
    order: [["code", "ASC"]],
    limit: 5,
  });
  if (!states.length) throw new Error("No state offices found to attach seed rows");

  // Clear previous demo rows (children first)
  await MeetingItem.destroy({ where: { meeting_id: { [Op.like]: "SEED-MTG-%" } } });
  await clearSeed(MeetingReport, "meeting_id", "SEED-MTG-");
  await EtmcEntry.destroy({ where: { etmc_id: { [Op.like]: "SEED-ETMC-%" } } });
  await clearSeed(EtmcReport, "etmc_id", "SEED-ETMC-");
  await clearSeed(VehicleMaintenanceReport, "reference_id", "SEED-VEH-");
  await clearSeed(IctSupportRegisterReport, "reference_id", "SEED-ICT-");
  await clearSeed(ConflictInfractionReport, "reference_id", "SEED-CIF-");
  await clearSeed(EnrolleeFeedbackReport, "reference_id", "SEED-EFS-");

  let meetings = 0;
  let etmc = 0;
  let vehicles = 0;
  let ict = 0;
  let conflicts = 0;
  let feedback = 0;

  for (let i = 0; i < states.length; i += 1) {
    const state = states[i];
    const month = i + 1;
    const status = STATUSES[i];
    const label = state.description || state.code;
    const submitted = status === "draft" ? null : dateInMonth(YEAR, month, 10);

    // ── Meetings & Coordination ──────────────────────────────────────────
    const meetingId = `SEED-MTG-${pad(i + 1, 3)}`;
    try {
      await MeetingReport.create({
        meeting_id: meetingId,
        state_code: state.code,
        zonal_code: state.zonal_code,
        reporting_year: YEAR,
        reporting_month: month,
        meeting_date: dateInMonth(YEAR, month, 6),
        meeting_type: MEETING_TYPES[i],
        other_meeting_type: MEETING_TYPES[i] === "Other" ? "Seed coordination meeting" : null,
        purpose: `${label} monthly coordination`,
        presiding_officer: "State Coordinator",
        venue: i % 2 === 0 ? "Physical" : "Virtual",
        staff_strength: 12 + i,
        attendees: 9 + i,
        attendance_rate: 75 + i,
        eff_prev_reviewed: "Yes",
        eff_issues_discussed: "Yes",
        eff_decisions_documented: "Yes",
        eff_officers_assigned: "Yes",
        eff_deadlines_assigned: i % 2 === 0 ? "Yes" : "Partially",
        eff_escalations_identified: "No",
        eff_attendance_adequate: "Yes",
        prepared_by: "Admin Desk",
        designation: "State Admin Officer",
        submission_date: submitted,
        endorsed_by: status === "submitted" ? "State Coordinator" : null,
        status,
        created_by_name: "Seed",
      });
      await MeetingItem.bulkCreate([
        {
          item_id: `SEED-MTG-AG-${pad(i + 1, 3)}`,
          meeting_id: meetingId,
          item_kind: "agenda",
          subject: "Enrolment progress",
          detail: "Review monthly enrolment against target",
          outcome: "Officers to close the gap before month end",
          requires_action: "Yes",
        },
        {
          item_id: `SEED-MTG-DC-${pad(i + 1, 3)}`,
          meeting_id: meetingId,
          item_kind: "decision",
          subject: "Follow up outstanding claims",
          detail: "Assign a desk officer",
          action_ref: `SEED-TAR-${pad(i + 1, 3)}`,
          responsible_officer: "Claims Officer",
          due_date: dateInMonth(YEAR, Math.min(month + 1, 12), 15),
          status: "Pending",
        },
        {
          item_id: `SEED-MTG-FU-${pad(i + 1, 3)}`,
          meeting_id: meetingId,
          item_kind: "followup",
          subject: "Previous action: ICT downtime escalation",
          detail: "Network restored; monitoring continues",
          status: i % 2 === 0 ? "Completed" : "In Progress",
          remarks: "Seed follow-up",
        },
      ]);
      meetings += 1;
    } catch (err) {
      console.warn(`Skipped meeting seed for ${state.code}: ${err.message}`);
    }

    const etmcId = `SEED-ETMC-${pad(i + 1, 3)}`;
    try {
      await EtmcReport.create({
        etmc_id: etmcId,
        state_code: state.code,
        zonal_code: state.zonal_code,
        reporting_year: YEAR,
        reporting_month: month,
        etmc_meeting_date: dateInMonth(YEAR, month, 12),
        cascade_session_date: dateInMonth(YEAR, month, 14),
        etmc_session: ETMC_SESSIONS[i],
        presiding_officer: "Zonal Coordinator",
        venue: i % 2 === 0 ? "Physical" : "Virtual",
        staff_strength: 20 + i,
        staff_present: 16 + i,
        attendance_rate: 80 + i,
        ev_attendance_list: "Yes",
        ev_minutes: "Yes",
        ev_presentation: "Yes",
        ev_photographs: i % 2 === 0 ? "Yes" : "No",
        ev_action_tracker: "Yes",
        ev_escalations_documented: "Partially",
        prepared_by: "Programmes Desk",
        designation: "State Programmes Officer",
        submission_date: submitted,
        endorsed_by: status === "submitted" ? "State Coordinator" : null,
        status,
        created_by_name: "Seed",
      });
      await EtmcEntry.bulkCreate([
        {
          entry_id: `SEED-ETMC-HL-${pad(i + 1, 3)}`,
          etmc_id: etmcId,
          entry_kind: "highlight",
          subject: "Quarterly performance",
          detail: `${label}: enrolment and provider compliance on track`,
        },
        {
          entry_id: `SEED-ETMC-DU-${pad(i + 1, 3)}`,
          etmc_id: etmcId,
          entry_kind: "department_update",
          subject: "Admin / HR",
          detail: "Vehicle and ICT registers updated for the period",
        },
        {
          entry_id: `SEED-ETMC-RS-${pad(i + 1, 3)}`,
          etmc_id: etmcId,
          entry_kind: "resolution",
          subject: "Close open conflict cases",
          detail: "State offices to conclude pending conflict/infraction resolutions within 14 days",
          owner_deadline: `State Coordinator · ${dateInMonth(YEAR, Math.min(month + 1, 12), 20)}`,
        },
        {
          entry_id: `SEED-ETMC-FB-${pad(i + 1, 3)}`,
          etmc_id: etmcId,
          entry_kind: "feedback",
          subject: "Cascade feedback",
          detail: "Officers acknowledged action tracker and deadlines",
        },
      ]);
      etmc += 1;
    } catch (err) {
      console.warn(`Skipped ETMC seed for ${state.code}: ${err.message}`);
    }

    // ── Vehicle Maintenance ──────────────────────────────────────────────
    await VehicleMaintenanceReport.create({
      reference_id: `SEED-VEH-${pad(i + 1, 3)}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: YEAR,
      reporting_month: month,
      submission_date: submitted,
      submitted_by: "Transport Desk (Demo)",
      status,
      title: vehiclePayload(i).rows[0].vehicleModel,
      payload: vehiclePayload(i),
    });
    vehicles += 1;

    // ── ICT Support Register ─────────────────────────────────────────────
    const line = ictLine(i, month);
    await IctSupportRegisterReport.create({
      reference_id: `SEED-ICT-${pad(i + 1, 3)}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: YEAR,
      reporting_month: month,
      submission_date: submitted,
      submitted_by: "ICT Desk (Demo)",
      status,
      title: line.support_id,
      payload: { lines: [line] },
    });
    ict += 1;

    // ── Conflict / Infraction (+ resolution) ─────────────────────────────
    const conflict = conflictPayload(label, i, month);
    await ConflictInfractionReport.create({
      reference_id: `SEED-CIF-${pad(i + 1, 3)}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: YEAR,
      reporting_month: month,
      submission_date: submitted,
      submitted_by: "Admin Desk (Demo)",
      status,
      title: conflict.reportingOfficer,
      payload: conflict,
    });
    conflicts += 1;

    // ── Enrollee Feedback (bonus — same pack) ────────────────────────────
    await EnrolleeFeedbackReport.create({
      reference_id: `SEED-EFS-${pad(i + 1, 3)}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: YEAR,
      reporting_month: month,
      submission_date: submitted,
      submitted_by: "Front Desk (Demo)",
      status,
      title: feedbackPayload(i, month).visitPurpose[0],
      payload: feedbackPayload(i, month),
    });
    feedback += 1;
  }

  console.log("── Seed summary ──");
  console.log(`Meeting reports:        ${meetings}`);
  console.log(`ETMC reports:           ${etmc}`);
  console.log(`Vehicle maintenance:    ${vehicles}`);
  console.log(`ICT support:            ${ict}`);
  console.log(`Conflict / resolution:  ${conflicts}`);
  console.log(`Enrollee feedback:      ${feedback}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error("❌  Seed failed:", err.message);
  console.error(err);
  try { await sequelize.close(); } catch { /* ignore */ }
  process.exit(1);
});
