/**
 * Seed sample Admin / HR reports — 5 records per report type.
 * Idempotent via stable reference IDs (SEED-SOM-01 … SEED-EFS-05).
 *
 *   npm run db:seed-admin-hr
 *   node src/scripts/seedAdminHr.js
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { StateOffice, AdminHrReport } = require("../models");
const { logPartial } = require("../utils/seedUtils");

const YEAR = 2026;
const SUBMITTED_BY = "State Office Officer";

const STATE_CODES = ["LAG", "KAN", "FCT", "RIV", "OYO"];
const STATE_LABELS = {
  LAG: "Lagos",
  KAN: "Kano",
  FCT: "FCT (Abuja)",
  RIV: "Rivers",
  OYO: "Oyo",
};

const STATUSES = ["approved", "approved", "submitted", "submitted", "draft"];

const isLegacyCode = (code) => /^SO-\d+$/i.test(code || "");

async function resolveGeo(stateCode) {
  const label = STATE_LABELS[stateCode];
  if (!label) throw new Error(`Unknown state code: ${stateCode}`);

  const token = label.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const candidates = await StateOffice.findAll({
    where: {
      [Op.or]: [
        { code: stateCode },
        { description: label },
        { description: { [Op.like]: `%${token}%` } },
      ],
    },
    order: [["code", "ASC"], ["id", "ASC"]],
  });
  if (!candidates.length) {
    throw new Error(`State not found for ${stateCode}. Run: npm run db:seed-zones-states`);
  }

  let best = candidates[0];
  for (const s of candidates) {
    if (s.code === stateCode && !isLegacyCode(s.code)) {
      best = s;
      break;
    }
    if (!isLegacyCode(s.code) && isLegacyCode(best.code)) best = s;
  }
  return {
    state_id: best.id,
    zone_id: best.zonal_id,
    label: best.description,
    code: stateCode,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateInMonth(year, month, day) {
  const d = Math.min(day, 28);
  return `${year}-${pad(month)}-${pad(d)}`;
}

async function upsertReport({ reference_id, report_type, geo, month, status, title, payload }) {
  const existing = await AdminHrReport.findOne({ where: { reference_id } });
  if (existing) return false;

  await AdminHrReport.create({
    reference_id,
    report_type,
    zone_id: geo.zone_id,
    state_id: geo.state_id,
    reporting_year: YEAR,
    reporting_month: month,
    submission_date: status === "draft" ? null : dateInMonth(YEAR, month, 22),
    submitted_by: SUBMITTED_BY,
    status,
    title,
    payload,
  });
  return true;
}

function meetingPayload(geo, i, month) {
  const meetingDate = dateInMonth(YEAR, month, 5 + i);
  return {
    meetingDate,
    meetingType: ["Management Meeting", "Staff Meeting", "Technical Meeting", "Stakeholder Meeting", "Other"][i],
    purpose: `${geo.label} monthly coordination — sample ${i + 1}`,
    presidingOfficer: ["A. Bello", "C. Okoro", "D. Yusuf", "E. Adeyemi", "F. Nwosu"][i],
    venue: i % 2 === 0 ? "Physical" : "Virtual",
    staffStrength: 18 + i,
    attendeesCount: 14 + i,
    attendanceNote: "Quorum achieved",
    keyIssues: [
      {
        agenda: "Enrolment drive",
        keyIssue: "Low rural uptake",
        keyOutcome: "Extend outreach to LGAs",
        requiresAction: "Yes",
      },
    ],
    decisions: [
      {
        decision: "Deploy mobile enrolment team",
        actionPoint: "Schedule LGA visits",
        expectedOutput: "Visit plan",
        responsibleOfficer: "Operations Lead",
        deadline: dateInMonth(YEAR, month, 28),
        status: "In Progress",
      },
    ],
    followups: [
      {
        actionPoint: "Previous quarter backlog",
        progress: "60% cleared",
        remarks: "On track",
        responsibleOfficer: "Admin Officer",
        dueDate: dateInMonth(YEAR, month, 20),
        status: "In Progress",
      },
    ],
    matters: [
      {
        matter: "Office AC repair",
        reason: "Service delay",
        actionExpected: "Engage contractor",
        programArea: "Admin",
        supportRequired: "Zonal approval",
        priority: "Medium",
        status: "Pending",
      },
    ],
    effectiveness: {
      previousReviewed: "Yes",
      programmeDiscussed: "Yes",
      decisionsDocumented: "Yes",
      officersAssigned: "Yes",
      deadlinesAssigned: "Yes",
      attendanceAdequate: "Yes",
      mattersEscalated: i === 4 ? "Yes" : "No",
      evidenceNote: "Minutes filed",
    },
    preparedBy: "Admin HR Desk",
    designation: "State Admin Officer",
    preparedDate: meetingDate,
    endorsedBy: "State Coordinator",
  };
}

function etmcPayload(geo, i, month) {
  return {
    etmcMeetingDate: dateInMonth(YEAR, month, 3),
    cascadeSessionDate: dateInMonth(YEAR, month, 10 + i),
    etmcSession: `Session ${i + 1}`,
    venue: i % 2 === 0 ? "Physical" : "Virtual",
    cascadeMode: i % 2 === 0 ? "Physical" : "Virtual",
    personLeading: ["G. Ibrahim", "H. Okeke", "I. Musa", "J. Ojo", "K. Danjuma"][i],
    staffStrength: 20,
    staffPresent: 16 + (i % 4),
    highlights: [
      { highlight: "Policy update on claims TAT", implication: "Faster processing", actionRequired: "Brief HMOs" },
    ],
    departments: [
      { department: "Operations", discussion: "Enrolment targets", resolution: "Weekly review" },
    ],
    resolutions: [
      {
        resolution: "Cascade ETMC decisions within 7 days",
        responsibleOfficer: "State Coordinator",
        deadline: dateInMonth(YEAR, month, 25),
        priority: "High",
        status: "In Progress",
      },
    ],
    comments: [{ comment: `${geo.label} cascade completed successfully` }],
    feedback: [{ feedback: "Staff requested printed circulars" }],
    evidence: "Attendance sheet attached",
    preparedBy: "ETMC Desk",
    designation: "State Officer",
    preparedDate: dateInMonth(YEAR, month, 12 + i),
    endorsedBy: "State Coordinator",
  };
}

function accommodationPayload(i) {
  return {
    rows: [
      {
        ownershipStatus: ["Rented", "NHIA-owned", "Co-habiting", "Rented", "NHIA-owned"][i],
        rentAmount: [850000, null, 0, 920000, null][i],
        landlord: ["ABC Properties", "N/A", "State Secretariat", "Delta Estates", "N/A"][i],
        leaseStart: dateInMonth(YEAR, 1, 1),
        leaseEnd: dateInMonth(YEAR + 1, 12, 31),
        officeCondition: ["Good", "Fair", "Good", "Requires Major Repairs", "Good"][i],
        remarks: ["Stable tenancy", "Owned premises", "Shared wing", "Roof leaks noted", "Renovated wing"][i],
      },
    ],
  };
}

function utilityPayload(i) {
  return {
    rows: [
      {
        utilityCategory: ["Generator Services", "Cleaning & Horticulture", "Security", "Generator Services", "Cleaning & Horticulture"][i],
        contractor: ["PowerPlus Ltd", "GreenClean", "SecureGuard", "GenTech", "Sparkle Facilities"][i],
        amountDue: [120000, 45000, 80000, 135000, 50000][i],
        paymentStatus: ["Paid", "Pending", "Paid", "Partial", "Pending"][i],
        servicePeriod: `Q${(i % 4) + 1} ${YEAR}`,
        remarks: "Seed sample utility entry",
      },
    ],
  };
}

function vehiclePayload(i) {
  return {
    rows: [
      {
        maintenanceType: i % 2 === 0 ? "Preventive Maintenance" : "Emergency Repair",
        vehicleReg: [`LG-${100 + i}-ABC`, `KN-${200 + i}-XYZ`, `FCT-${300 + i}-AA`, `RV-${400 + i}-BB`, `OY-${500 + i}-CC`][i],
        problemReported: ["Routine service", "Battery failure", "Brake pads", "AC compressor", "Tyre replacement"][i],
        workshop: ["NHIA Workshop", "AutoCare", "State Mechanic", "FleetFix", "MotorHub"][i],
        vehicleStatus: i === 3 ? "Restricted Use" : "Operational",
        dateIn: dateInMonth(YEAR, i + 1, 8),
        dateOut: dateInMonth(YEAR, i + 1, 12),
        remarks: "Seed sample maintenance entry",
      },
    ],
  };
}

function conflictPayload(geo, i, month) {
  return {
    refNo: null,
    dateOfReport: dateInMonth(YEAR, month, 4 + i),
    reportingOfficer: ["L. Ade", "M. Bassey", "N. Garba", "O. Uche", "P. Sule"][i],
    officeLocation: `${geo.label} State Office`,
    staff1: "Officer A",
    staff2: "Officer B",
    incidentDate: dateInMonth(YEAR, month, 2 + i),
    location: "Admin block",
    natures: [["Insubordination"], ["Misconduct / Ethical Breach"], ["Resource / Budget-line Dispute"], ["Interpersonal / Personality Conflict"], ["Other"]][i],
    otherSpecify: i === 4 ? "Work schedule disagreement" : "",
    description: `Sample conflict report ${i + 1} for ${geo.label}`,
    immediateAction: "Parties counselled separately",
    recommendedResolution: "Mediation meeting with HOD",
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

const DEFINITIONS = [
  {
    report_type: "office-meeting",
    prefix: "SOM",
    title: (geo, i) => `${geo.label} Management Meeting ${i + 1}`,
    payload: meetingPayload,
  },
  {
    report_type: "etmc-cascading",
    prefix: "ETC",
    title: (geo, i) => `${geo.label} ETMC Cascade ${i + 1}`,
    payload: etmcPayload,
  },
  {
    report_type: "office-accommodation",
    prefix: "OAC",
    title: (geo) => `${geo.label} Office Accommodation`,
    payload: (_geo, i) => accommodationPayload(i),
  },
  {
    report_type: "utility-services",
    prefix: "UTL",
    title: (geo) => `${geo.label} Utility Services`,
    payload: (_geo, i) => utilityPayload(i),
  },
  {
    report_type: "vehicle-maintenance",
    prefix: "VEH",
    title: (geo) => `${geo.label} Vehicle Maintenance`,
    payload: (_geo, i) => vehiclePayload(i),
  },
  {
    report_type: "conflict-infraction",
    prefix: "CIF",
    title: (geo, i) => `${geo.label} Conflict Report ${i + 1}`,
    payload: conflictPayload,
  },
  {
    report_type: "enrollee-feedback",
    prefix: "EFS",
    title: (geo, i) => `${geo.label} Feedback Survey ${i + 1}`,
    payload: (geo, i, month) => feedbackPayload(i, month),
  },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    await AdminHrReport.sync({ alter: true });
    console.log("✅  admin_hr_reports ready");

    const geos = [];
    for (const code of STATE_CODES) {
      geos.push(await resolveGeo(code));
    }
    console.log(`📍  Using states: ${geos.map((g) => g.label).join(", ")}`);

    let created = 0;
    let skipped = 0;

    for (const def of DEFINITIONS) {
      let typeCreated = 0;
      for (let i = 0; i < 5; i++) {
        const geo = geos[i];
        const month = i + 1;
        const reference_id = `SEED-${def.prefix}-${pad(i + 1)}`;
        const ok = await upsertReport({
          reference_id,
          report_type: def.report_type,
          geo,
          month,
          status: STATUSES[i],
          title: def.title(geo, i),
          payload: def.payload(geo, i, month),
        });
        if (ok) {
          created += 1;
          typeCreated += 1;
        } else {
          skipped += 1;
        }
      }
      console.log(`  → ${def.report_type}: ${typeCreated} new (of 5)`);
    }

    logPartial("Admin/HR sample reports", created, skipped);
    process.exit(0);
  } catch (err) {
    console.error("❌  Admin/HR seed failed:", err);
    process.exit(1);
  }
})();
