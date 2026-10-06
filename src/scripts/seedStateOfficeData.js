/**
 * Seed realistic State Office sample data across all report modules.
 * Idempotent — uses stable reference IDs (no SEED prefix).
 * Run: npm run db:seed-state-office
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  StateOffice, User,
  EnrolmentReport, EnrolmentReportLine,
  MigrationReport, MigrationReportLine,
  CemoncReport, CemoncReportLine,
  IgrReport, IgrReportLine,
  SshiaFinancialReport, SshiaFinancialReportLine,
  ExpenditureProfileReport, ExpenditureProfileReportLine,
  ComplaintsComplianceReport,
  AccreditationReport, AccreditationReportLine,
  StakeholderReport, StakeholderReportLine,
  EnrolmentDriveReport, EnrolmentDriveReportLine,
  HmoSelectionReport, HmoSelectionReportLine,
  ChallengesReport,
  ExtraDependantReport, ExtraDependantReportLine,
  HcpChangeReport, HcpChangeReportLine,
  WeeklyActionableReport, WeeklyActionableReportLine,
  ContractedServicesReport, ContractedServicesReportLine,
  IctSupportReport, IctSupportReportLine,
  AdhocAssignmentReport, AdhocAssignmentReportLine,
  MonthlyEnrolleeRegister,
  EtmcTmcActionPointRegister, EtmcTmcActionPointLine,
  StateOfficeComplaint,
  StateOfficeComplianceVisit,
  StateOfficeMysteryShopping,
  StateOfficeHmoIndebtedness, StateOfficeHmoIndebtednessLine,
  StateOfficeReconciliationMeeting,
  NhiaAccreditedProvider,
  StateZonalOfficeProfile, StateZonalFocalPerson,
} = require("../models");
const { DOMAINS: FOCAL_DOMAINS } = require("../models/StateZonalFocalPerson");
const {
  ComplaintSummaryLine, ComplaintStatusLine,
  ComplianceVisitLine, ReconciliationLine,
} = require("../models/ComplaintsComplianceLines");
const { syncStateOfficeTables } = require("./stateOfficeTableSync");

const STATE_ID_TABLES = [
  "users",
  "enrolment_reports", "migration_reports", "cemonc_reports",
  "igr_reports", "sshia_financial_reports", "expenditure_profile_reports",
  "complaints_compliance_reports", "accreditation_reports", "stakeholder_reports",
  "hmo_selection_reports", "challenges_reports",
  "extra_dependant_reports", "hcp_change_reports",
  "state_office_complaints", "state_office_compliance_visits",
  "state_office_reconciliation_meetings",
  "servicom_complaints", "servicom_facilities", "monitoring_visits",
  "stock_verifications", "stock_assets",
  "finance_monthly_reports", "programmes_monthly_reports", "sqa_monthly_reports",
];

const STATE_LABELS = {
  LAG: "Lagos", KAN: "Kano", FCT: "FCT (Abuja)", RIV: "Rivers",
  IMO: "Imo", KAD: "Kaduna", OYO: "Oyo", OND: "Ondo",
};

const SUBMITTED_BY = "State Office Officer";
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTER_END_MONTHS = [3, 6, 9, 12];
const isLegacyCode = (code) => /^SO-\d+$/i.test(code || "");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);

const refId = (prefix, code, year, month) =>
  `${prefix}-${year}-${code}-${String(month).padStart(2, "0")}`;

const monthStatus = (month) => {
  if (month <= 9) return "approved";
  if (month === 10) return "submitted";
  return "draft";
};

/** Pick canonical state row (non-legacy code) — matches /api/stock/states dedupe */
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
    if (s.code === stateCode && !isLegacyCode(s.code)) { best = s; break; }
    if (!isLegacyCode(s.code) && isLegacyCode(best.code)) best = s;
  }
  return { state_id: best.id, zone_id: best.zonal_id, label: best.description, code: stateCode };
}

/** Point legacy duplicate state_id references at the canonical state row */
async function realignLegacyStateUsers() {
  const states = await StateOffice.findAll({ order: [["description", "ASC"], ["code", "ASC"]] });
  const canonicalByDesc = new Map();
  for (const s of states) {
    const key = s.description.trim().toLowerCase();
    const existing = canonicalByDesc.get(key);
    if (!existing || (isLegacyCode(existing.code) && !isLegacyCode(s.code))) {
      canonicalByDesc.set(key, s);
    }
  }

  let updated = 0;
  for (const s of states) {
    if (!isLegacyCode(s.code)) continue;
    const canonical = canonicalByDesc.get(s.description.trim().toLowerCase());
    if (!canonical || canonical.id === s.id) continue;

    for (const table of STATE_ID_TABLES) {
      try {
        const [, meta] = await sequelize.query(
          `UPDATE \`${table}\` SET state_id = ? WHERE state_id = ?`,
          { replacements: [canonical.id, s.id] },
        );
        updated += meta?.affectedRows ?? 0;
      } catch (err) {
        const code = err.parent?.code || err.original?.code;
        if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR") continue;
        throw err;
      }
    }

    try {
      const [, meta] = await sequelize.query(
        "UPDATE `users` SET zone_id = ? WHERE state_id = ?",
        { replacements: [canonical.zonal_id, canonical.id] },
      );
      updated += meta?.affectedRows ?? 0;
    } catch { /* ignore */ }
  }
  return updated;
}

async function safeDestroy(Model, where) {
  try {
    return await Model.destroy({ where });
  } catch (err) {
    if (err.parent?.code === "ER_NO_SUCH_TABLE" || err.original?.code === "ER_NO_SUCH_TABLE") {
      return 0;
    }
    throw err;
  }
}

async function purgeLegacySeedRefs() {
  const like = { [Op.like]: "SEED-%" };
  const models = [
    EnrolmentReport, MigrationReport, CemoncReport, IgrReport,
    SshiaFinancialReport, ExpenditureProfileReport, ComplaintsComplianceReport,
    AccreditationReport, StakeholderReport, HmoSelectionReport, ChallengesReport,
    ExtraDependantReport, HcpChangeReport,
    StateOfficeComplianceVisit, StateOfficeReconciliationMeeting,
  ];
  let removed = 0;
  for (const M of models) {
    removed += await safeDestroy(M, { reference_id: like });
  }
  removed += await safeDestroy(StateOfficeComplaint, { complaint_number: like });
  return removed;
}

function reportHeader(geo, year, month, status) {
  return {
    zone_id: geo.zone_id,
    state_id: geo.state_id,
    reporting_year: year,
    reporting_month: month,
    submission_date: `${year}-${String(month).padStart(2, "0")}-28`,
    submitted_by: SUBMITTED_BY,
    status: status || monthStatus(month),
  };
}

function sshiaLine(sub_head, opening, receipts, expenditure) {
  const A = opening; const B = receipts; const D = expenditure;
  const C = A + B; const E = C - D;
  const F = D !== 0 ? (C / D) * 100 : 0;
  return { sub_head, opening_balance: A, receipts: B, total_budget: C, actual_expenditure: D, balance: E, variance_pct: F };
}

async function seedEnrolmentMonth(geo, year, month) {
  const ref = refId("ENR", geo.code, year, month);
  const [report, created] = await EnrolmentReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const q = quarterFromMonth(month);
    const base = 80 + month * 12;
    await EnrolmentReportLine.bulkCreate([
      { report_id: report.id, category: "mop_up", enrolment_count: base + 40, quarter: q },
      { report_id: report.id, category: "gifship", enrolment_count: base + 20, quarter: q },
      { report_id: report.id, category: "ops", enrolment_count: Math.round(base * 0.4), quarter: q },
      { report_id: report.id, category: "sshia", enrolment_count: base + 10, quarter: q },
    ]);
  }
  return created ? 1 : 0;
}

async function seedMigrationMonth(geo, year, month) {
  const ref = refId("MIG", geo.code, year, month);
  const [report, created] = await MigrationReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const q = quarterFromMonth(month);
    const n = 15 + month * 3;
    await MigrationReportLine.bulkCreate([
      { report_id: report.id, request_type: "change_of_facility", request_count: n + 5, quarter: q },
      { report_id: report.id, request_type: "correction_of_data", request_count: n, quarter: q },
      { report_id: report.id, request_type: "change_of_mda", request_count: Math.round(n * 0.5), quarter: q },
    ]);
  }
  return created ? 1 : 0;
}

async function seedCemoncMonth(geo, year, month) {
  const ref = refId("CEM", geo.code, year, month);
  const [report, created] = await CemoncReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    await CemoncReportLine.bulkCreate([
      { report_id: report.id, intervention_type: "cemonc", facility_name: `${geo.label} Specialist Hospital`, beneficiaries: 10 + month * 2 },
      { report_id: report.id, intervention_type: "ffp", facility_name: `${geo.label} General Hospital`, beneficiaries: 6 + month },
    ]);
  }
  return created ? 1 : 0;
}

async function seedIgrMonth(geo, year, month) {
  const ref = refId("IGR", geo.code, year, month);
  const [report, created] = await IgrReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const q = quarterFromMonth(month);
    const d = String(month).padStart(2, "0");
    const amt = 5000 + month * 1500;
    await IgrReportLine.bulkCreate([
      { report_id: report.id, entry_date: `${year}-${d}-05`, service_type: "enrollee_update", principal_name: "Enrollee — Data Update", receipt_no: `RCP-${geo.code}${d}01`, bill_rrr_no: `RRR-${geo.code}${d}01`, nin_charge: 0, amount: 2500, quarter: q },
      { report_id: report.id, entry_date: `${year}-${d}-12`, service_type: "accreditation", principal_name: "Private Medical Centre", receipt_no: `RCP-${geo.code}${d}02`, bill_rrr_no: `RRR-${geo.code}${d}02`, nin_charge: 0, amount: amt * 10, quarter: q },
      { report_id: report.id, entry_date: `${year}-${d}-18`, service_type: "gifship", principal_name: "GIFSHIP Enrollee", receipt_no: `RCP-${geo.code}${d}03`, bill_rrr_no: `RRR-${geo.code}${d}03`, nin_charge: 500, amount: 12000, quarter: q },
      { report_id: report.id, entry_date: `${year}-${d}-22`, service_type: "application", principal_name: "New Enrollee Application", receipt_no: `RCP-${geo.code}${d}04`, bill_rrr_no: `RRR-${geo.code}${d}04`, nin_charge: 0, amount: amt, quarter: q },
    ]);
  }
  return created ? 1 : 0;
}

async function seedSshiaQuarter(geo, year, month) {
  const q = quarterFromMonth(month);
  const ref = refId("SSHIA", geo.code, year, month);
  const [report, created] = await SshiaFinancialReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month, "approved"), reference_id: ref },
  });
  if (created) {
    const m = month;
    const rows = [
      sshiaLine("capitation", 2000000 + m * 50000, 1500000 + m * 30000, 1800000 + m * 40000),
      sshiaLine("fee_for_service", 600000 + m * 20000, 500000, 550000 + m * 15000),
      sshiaLine("reserve_funds", 400000, 0, 80000 + m * 5000),
      sshiaLine("admin_charge", 120000, 60000 + m * 2000, 110000),
      sshiaLine("operations", 250000 + m * 10000, 180000, 300000 + m * 8000),
    ].map((r) => ({ report_id: report.id, ...r, quarter: q }));
    await SshiaFinancialReportLine.bulkCreate(rows);
  }
  return created ? 1 : 0;
}

async function seedExpenditureQuarter(geo, year, month) {
  const q = quarterFromMonth(month);
  const ref = refId("EXPND", geo.code, year, month);
  const [report, created] = await ExpenditureProfileReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const m = month;
    await ExpenditureProfileReportLine.bulkCreate([
      { report_id: report.id, sub_head: "fuel_lub", amount: 120000 + m * 5000, quarter: q },
      { report_id: report.id, sub_head: "utilities", amount: 70000 + m * 2000, quarter: q },
      { report_id: report.id, sub_head: "printing_stationery", amount: 35000 + m * 1000, quarter: q },
      { report_id: report.id, sub_head: "transport_travel", amount: 90000 + m * 4000, quarter: q },
      { report_id: report.id, sub_head: "maint_veh", amount: 55000 + m * 2500, quarter: q },
      { report_id: report.id, sub_head: "tel_postages", amount: 25000 + m * 800, quarter: q },
      { report_id: report.id, sub_head: "ent_hosp", amount: 20000 + m * 500, quarter: q },
      { report_id: report.id, sub_head: "bank_charges", amount: 12000, quarter: q },
    ]);
  }
  return created ? 1 : 0;
}

async function seedComplaintsComplianceMonth(geo, year, month) {
  const ref = refId("CMP", geo.code, year, month);
  const [report, created] = await ComplaintsComplianceReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const hmo = 5 + month;
    const hcp = 3 + Math.floor(month / 2);
    await ComplaintSummaryLine.bulkCreate([
      { report_id: report.id, category: "against_hmo", complaint_count: hmo },
      { report_id: report.id, category: "against_hcp", complaint_count: hcp },
    ]);
    await ComplaintStatusLine.bulkCreate([
      { report_id: report.id, status: "resolved", status_count: hmo + hcp - 4 },
      { report_id: report.id, status: "pending", status_count: 2 },
      { report_id: report.id, status: "escalated", status_count: 1 },
      { report_id: report.id, status: "unresolved", status_count: 1 },
    ]);
    const d = String(month).padStart(2, "0");
    await ComplianceVisitLine.bulkCreate([
      { report_id: report.id, facility_visited: `${geo.label} General Hospital`, visit_date: `${year}-${d}-10`, purpose: "Routine NHIA desk audit", outcome: "Documentation reviewed; minor gaps noted" },
      { report_id: report.id, facility_visited: "Accredited Private Clinic", visit_date: `${year}-${d}-20`, purpose: "Complaint follow-up", outcome: "Corrective action in progress" },
    ]);
    await ReconciliationLine.bulkCreate([
      { report_id: report.id, hmo: "Hygeia HMO", facility: `${geo.label} Specialist Hospital`, amount_owed: 1500000 + month * 100000, recon_status: "Partially reconciled", comment: `Q${quarterFromMonth(month)} capitation review` },
      { report_id: report.id, hmo: "Reliance HMO", facility: "Faith Medical Centre", amount_owed: 600000 + month * 50000, recon_status: "Reconciled", comment: "Payment confirmed" },
    ]);
  }
  return created ? 1 : 0;
}

async function seedAccreditationMonth(geo, year, month) {
  const d = String(month).padStart(2, "0");
  const status = month <= 9 ? "Completed" : month === 10 ? "In Progress" : "Deferred";
  const modules = [
    {
      key: "accreditation",
      prefix: "ACCR",
      category: "Accreditation",
      code: "PM-0001",
      metrics: {
        FSSHIP: {
          "Number of Applications Received": 4 + month,
          "Number of Accreditation Forms Sent": 3 + month,
          "Number of Completed Returned Forms": 2 + month,
          "Number of Facilities Awaiting Accreditation": 1 + Math.floor(month / 4),
          "Number of Facilities Accredited": 2 + Math.floor(month / 3),
        },
      },
    },
    {
      key: "reaccreditation",
      prefix: "REAC",
      category: "Re-accreditation",
      code: "PM-0002",
      metrics: {
        FSSHIP: {
          "Number of Facilities Awaiting Re-accreditation": 2 + Math.floor(month / 5),
          "Number of Facilities Re-accredited": 1 + Math.floor(month / 4),
        },
      },
    },
    {
      key: "medical-audits",
      prefix: "MEDA",
      category: "Medical Audit",
      code: "PM-0004",
      metrics: {
        FSSHIP: {
          "Number of Audits Planned": 3,
          "Number of Audits Conducted": month <= 9 ? 2 : 1,
        },
      },
    },
    {
      key: "qa-inspections",
      prefix: "QAINS",
      category: "Quality Assurance",
      code: "PM-0003",
      metrics: {
        FSSHIP: {
          "Number of Facilities Inspected": 3 + Math.floor(month / 3),
          "Number of QA Reports Completed": 2 + Math.floor(month / 4),
        },
      },
    },
  ];

  let createdCount = 0;
  for (const mod of modules) {
    // Skip some months for variety on non-core modules so lists still look monthly but not identical
    if (mod.key !== "accreditation" && month % 2 === 0 && geo.code !== "KAN") continue;

    const ref = `${mod.prefix}-${year}-${geo.code}-${d}`;
    const [report, created] = await AccreditationReport.findOrCreate({
      where: { reference_id: ref },
      defaults: {
        ...reportHeader(geo, year, month),
        reference_id: ref,
        activity_module: mod.key,
        planned_activities: 2,
      },
    });
    if (!created) {
      if (!report.activity_module) {
        await report.update({ activity_module: mod.key, planned_activities: report.planned_activities ?? 2 });
      }
      continue;
    }
    createdCount += 1;
    const program = "FSSHIP";
    const metricMap = mod.metrics[program] || {};
    await AccreditationReportLine.bulkCreate([
      {
        report_id: report.id,
        indicator: "accreditation_applications",
        primary_count: 2 + Math.floor(month / 3),
        secondary_count: 3,
        activity_template: {
          engagement_code: mod.code,
          activity_date: `${year}-${d}-12`,
          engagement_category: mod.category,
          specific_activity: `${mod.category} visit — ${geo.label}`,
          engagement_purpose: `Routine ${mod.category.toLowerCase()} for ${geo.label} facilities`,
          funding_option: "Funded (Budgetary)",
          activity_budget: 250000 + month * 10000,
          approved_amount: 220000 + month * 8000,
          location_category: "State Capital",
          location_name: geo.label,
          programs_supported: [program],
          activity_details: JSON.stringify({ metrics: metricMap }),
          planned_target_stakeholders: 3,
          stakeholders_engaged: 2 + Math.floor(month / 4),
          follow_up_required: "Yes",
          follow_up_date: `${year}-${d}-28`,
          follow_up_visits: 1,
          supporting_evidence_types: ["Inspection Report", "Photographs"],
          outcome_category: "Programme implementation strengthened",
          specific_outcome: `${mod.category} completed for sample facilities`,
          expected_output: "Signed checklist and facility report",
          activity_status: status,
          remarks: `${geo.label} ${mod.key} sample seed`,
        },
      },
      {
        report_id: report.id,
        indicator: "accreditation_applications",
        primary_count: 1,
        secondary_count: 2,
        activity_template: {
          engagement_code: mod.code,
          activity_date: `${year}-${d}-22`,
          engagement_category: mod.category,
          specific_activity: `Follow-up ${mod.category} — BHCPF PHCs`,
          engagement_purpose: "PHC quality and readiness assessment",
          funding_option: "Routine",
          location_category: "LGA",
          location_name: `${geo.label} Central LGA`,
          programs_supported: ["BHCPF"],
          activity_details: JSON.stringify({
            metrics: Object.fromEntries(
              Object.entries(metricMap).map(([k, v]) => [k, Math.max(1, Math.floor(Number(v) / 2))]),
            ),
          }),
          planned_target_stakeholders: 2,
          stakeholders_engaged: 1,
          follow_up_required: "No",
          supporting_evidence_types: ["Signed Checklist", "Audit Report"],
          activity_status: status,
          remarks: "Second activity line for list density",
        },
      },
    ]);
  }
  return createdCount;
}

async function seedStakeholderMonth(geo, year, month) {
  const d = String(month).padStart(2, "0");
  const status = month <= 9 ? "Completed" : month === 10 ? "In Progress" : "Deferred";
  const modules = [
    {
      key: "engagement-coordination",
      prefix: "STKENG",
      lines: [
        { code: "ENG-003", category: "Post-enrolment Sensitization", activity: "Post-enrolment sensitisation with MDAs" },
        { code: "ENG-004", category: "Capacity Building", activity: "Capacity building for desk officers" },
        { code: "ENG-012", category: "Program Implementation/Monitoring", activity: "Programme implementation review" },
      ],
    },
    {
      key: "meetings-sshias",
      prefix: "STKSSH",
      lines: [
        { code: "ENG-001", category: "SSHIA Technical Support", activity: "SSHIA technical support session" },
        { code: "ENG-005", category: "BHCPF Gateway (SOC) Meeting", activity: "BHCPF gateway SOC meeting" },
        { code: "ENG-006", category: "Mediation Meetings", activity: "Claims mediation with SSHIA / HMO" },
      ],
    },
    {
      key: "stakeholder-forum",
      prefix: "STKFOR",
      lines: [
        { code: "ENG-002", category: "Stakeholder Forum/Meeting", activity: "State stakeholder forum" },
        { code: "ENG-011", category: "Stakeholder Consultative Meeting", activity: "Consultative meeting with labour unions" },
        { code: "ENG-010", category: "Workshops/Seminar/Summit", activity: "NHIA programme seminar" },
      ],
    },
    {
      key: "stakeholder-others",
      prefix: "STKOTH",
      lines: [
        { code: "ENG-007", category: "Ad-Hoc Activity", activity: "Ad-hoc governor's office briefing" },
        { code: "ENG-016", category: "Others (specify)", activity: "Other stakeholder outreach" },
      ],
    },
  ];

  let createdCount = 0;
  for (const mod of modules) {
    if (mod.key !== "engagement-coordination" && month % 2 === 0 && geo.code !== "KAN") continue;

    const ref = `${mod.prefix}-${year}-${geo.code}-${d}`;
    const [report, created] = await StakeholderReport.findOrCreate({
      where: { reference_id: ref },
      defaults: {
        ...reportHeader(geo, year, month),
        reference_id: ref,
        activity_module: mod.key,
        planned_activities: mod.lines.length,
      },
    });
    if (!created) {
      if (!report.activity_module) {
        await report.update({ activity_module: mod.key, planned_activities: report.planned_activities ?? mod.lines.length });
      }
      continue;
    }
    createdCount += 1;
    await StakeholderReportLine.bulkCreate(
      mod.lines.map((line, idx) => ({
        report_id: report.id,
        engagement_code: line.code,
        activity_date: `${year}-${d}-${String(8 + idx * 5).padStart(2, "0")}`,
        engagement_category: line.category,
        stakeholder_categories: idx % 2 === 0 ? ["MDAs", "SSHIA"] : ["HMOs", "HCFs"],
        stakeholder_names: `${geo.label} ${idx % 2 === 0 ? "Ministry of Health" : "HMO Forum"}`,
        specific_activity: line.activity,
        engagement_purpose: `Strengthen coordination for ${geo.label} state office programmes`,
        funding_option: "Budgeted (Approved Release)",
        activity_budget: 180000 + month * 5000 + idx * 10000,
        approved_amount: 160000 + month * 4000 + idx * 8000,
        planned_target_audience: 80 + month * 5,
        target_audience_reached: idx % 2 === 0
          ? ["Healthcare Workers", "Desk Officers"]
          : ["HMOs", "Healthcare Providers"],
        location_category: "State Capital",
        location_name: geo.label,
        programs_supported: ["FSSHIP", "GIFSHIP-G", "OPS"].slice(0, 1 + (idx % 3)),
        activity_details: `${line.activity} conducted in ${geo.label}`,
        planned_target_stakeholders: 25 + month,
        stakeholders_engaged: 20 + month - idx,
        follow_up_required: idx === 0 ? "Yes" : "No",
        follow_up_date: idx === 0 ? `${year}-${d}-28` : null,
        follow_up_visits: idx === 0 ? 1 : null,
        supporting_evidence_types: ["Attendance Register", "Photographs", "Minutes"],
        outcome_category: "Increased stakeholder commitment",
        specific_outcome: "No. of organisations requesting further engagement",
        expected_output: "Signed attendance and action points",
        activity_status: status,
        remarks: `${geo.label} ${mod.key} seed`,
        activity: line.category,
        audience_size: 20 + month - idx,
        organization: `${geo.label} ${idx % 2 === 0 ? "Ministry of Health" : "HMO Forum"}`,
        location: geo.label,
        key_outcomes: "Increased stakeholder commitment",
      })),
    );
  }
  return createdCount;
}

async function seedHmoSelectionMonth(geo, year, month) {
  if (month % 2 !== 0) return 0;
  const ref = refId("HMO", geo.code, year, month);
  const [report, created] = await HmoSelectionReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const d = String(month).padStart(2, "0");
    await HmoSelectionReportLine.bulkCreate([
      {
        report_id: report.id,
        mda: `${geo.label} Civil Service Commission`,
        selection_date: `${year}-${d}-05`,
        former_hmo: "Hygeia HMO",
        reason_for_change: "Service coverage gaps and delayed claims settlement",
        hmos_invited: 5,
        hmos_attended: 3,
        hmos_in_attendance: "3",
        compliance_guideline: "yes",
        transparent_process: "yes",
        selected_hmo: "Reliance HMO",
      },
      {
        report_id: report.id,
        mda: `${geo.label} Ministry of Education`,
        selection_date: `${year}-${d}-18`,
        former_hmo: "Avon Healthcare",
        reason_for_change: "Staff request for wider provider network",
        hmos_invited: 4,
        hmos_attended: 2,
        hmos_in_attendance: "2",
        compliance_guideline: "yes",
        transparent_process: "no",
        selected_hmo: "AXA Mansard Health",
      },
    ]);
  }
  return created ? 1 : 0;
}

async function seedExtraDependantMonth(geo, year, month, rows) {
  const ref = refId("XDEP", geo.code, year, month);
  const [report, created] = await ExtraDependantReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month, "submitted"), reference_id: ref },
  });
  if (created) {
    await ExtraDependantReportLine.bulkCreate(
      rows.map((row) => ({ report_id: report.id, ...row }))
    );
  }
  return created ? 1 : 0;
}

async function seedHcpChangeMonth(geo, year, month, rows) {
  const ref = refId("HCPC", geo.code, year, month);
  const [report, created] = await HcpChangeReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month, "submitted"), reference_id: ref },
  });
  if (created) {
    await HcpChangeReportLine.bulkCreate(
      rows.map((row) => ({ report_id: report.id, ...row }))
    );
  }
  return created ? 1 : 0;
}

async function seedHmoSelectionSample(geo, year, month, rows) {
  const ref = refId("HMO", geo.code, year, month);
  const [report, created] = await HmoSelectionReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month, "submitted"), reference_id: ref },
  });
  if (created) {
    await HmoSelectionReportLine.bulkCreate(
      rows.map((row) => ({ report_id: report.id, ...row }))
    );
  }
  return created ? 1 : 0;
}

async function seedChallengesQuarter(geo, year, month) {
  const ref = refId("CHL", geo.code, year, month);
  const q = quarterFromMonth(month);
  const [report, created] = await ChallengesReport.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...reportHeader(geo, year, month, month >= 10 ? "draft" : "submitted"),
      reference_id: ref,
      challenges: `Q${q} — Delayed capitation payments in ${geo.label}.\nLimited ICT bandwidth at rural facilities.\nHigh volume of data correction requests.`,
      recommendations: `Expedite Q${q} reconciliation with HMOs.\nDeploy mobile enrolment kits.\nAssign dedicated data-quality officer.`,
    },
  });
  return created ? 1 : 0;
}

async function seedEnrolleeComplaint(geo, year, month, seq, def) {
  const num = `SOC-${year}-${geo.code}-${String(seq).padStart(3, "0")}`;
  const d = String(month).padStart(2, "0");
  const day = String(Math.min(20 + seq, 28)).padStart(2, "0");
  const [, created] = await StateOfficeComplaint.findOrCreate({
    where: { complaint_number: num },
    defaults: {
      complaint_number: num,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year: year,
      reporting_month: month,
      against_type: def.against_type,
      entity_name: def.entity_name,
      entity_code: def.entity_code,
      complaint_date: `${year}-${d}-${day}`,
      description: def.description,
      status: def.status,
      assigned_officer: def.officer,
      resolution_notes: def.notes || null,
      resolution_date: def.resolved || null,
      created_by: SUBMITTED_BY,
    },
  });
  return created ? 1 : 0;
}

async function seedComplianceVisit(geo, year, month, seq, facility, purpose, outcome) {
  const ref = refId("SCV", geo.code, year, month * 10 + seq);
  const d = String(month).padStart(2, "0");
  const day = String(5 + seq * 3).padStart(2, "0");
  const [, created] = await StateOfficeComplianceVisit.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      reference_id: ref,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year: year,
      reporting_month: month,
      facility_visited: facility,
      visit_date: `${year}-${d}-${day}`,
      purpose,
      outcome,
      submitted_by: SUBMITTED_BY,
      status: monthStatus(month),
    },
  });
  return created ? 1 : 0;
}

async function seedWeeklyActionableMonth(geo, year, month) {
  const ref = refId("WKA", geo.code, year, month);
  const [report, created] = await WeeklyActionableReport.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...reportHeader(geo, year, month),
      reference_id: ref,
      reporting_week: ((month - 1) % 4) + 1,
    },
  });
  if (created) {
    const statuses = ["escalated", "awaiting_response", "awaiting_further_info", "resolved"];
    await WeeklyActionableReportLine.bulkCreate([
      {
        report_id: report.id,
        issue_request: `Delayed capitation remittance affecting ${geo.label} facilities`,
        category: "budgetary",
        impact: "high",
        urgency: "high",
        user_department: "Finance",
        priority_level: "P1",
        status: statuses[month % statuses.length],
      },
      {
        report_id: report.id,
        issue_request: `NHIA desk staffing gap at ${geo.label} state hospital`,
        category: "operational",
        impact: "medium",
        urgency: "medium",
        user_department: "Operations",
        priority_level: "P2",
        status: statuses[(month + 1) % statuses.length],
      },
    ]);
  }
  return created ? 1 : 0;
}

async function seedContractedServicesMonth(geo, year, month) {
  const ref = refId("CSR", geo.code, year, month);
  const [report, created] = await ContractedServicesReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const base = 150000 + month * 12000;
    await ContractedServicesReportLine.bulkCreate([
      { report_id: report.id, service: "security", month, beneficiary: `${geo.label} Guard Services Ltd`, amount: base },
      { report_id: report.id, service: "cleaning", month, beneficiary: `${geo.label} Hygiene Co.`, amount: Math.round(base * 0.6) },
      { report_id: report.id, service: "generator", month, beneficiary: `${geo.label} Power Maint.`, amount: Math.round(base * 0.45) },
    ]);
  }
  return created ? 1 : 0;
}

async function seedReconciliation(geo, year, month, seq, hmo, facility, amount, reconStatus) {
  const ref = refId("SRM", geo.code, year, month * 10 + seq);
  const [, created] = await StateOfficeReconciliationMeeting.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      reference_id: ref,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year: year,
      reporting_month: month,
      hmo,
      hmo_code: hmo.includes("Hygeia") ? "HMO-HYG" : hmo.includes("Reliance") ? "HMO-REL" : "HMO-AII",
      facility,
      amount_owed: amount,
      recon_status: reconStatus,
      comment: `Reconciliation for ${facility} — ${year}-${String(month).padStart(2, "0")}`,
      submitted_by: SUBMITTED_BY,
      status: "submitted",
    },
  });
  return created ? 1 : 0;
}

const DRIVE_TYPES = [
  { key: "advocacy", cat: "Advocacy", activity: "Courtesy visit to State Ministry of Health" },
  { key: "community-sensitization", cat: "Sensitization", activity: "Community sensitisation at LGA HQ" },
  { key: "informal-sector", cat: "Informal Sector Mobilization", activity: "Artisan association mobilisation" },
  { key: "enrolment-campaigns", cat: "Enrolment Campaigns", activity: "Weekend enrolment campaign" },
  { key: "market-religious", cat: "Market Association Outreach", activity: "Central market association outreach" },
  { key: "mda-engagement", cat: "MDA Engagement", activity: "MDA / OPS engagement meeting" },
  { key: "capacity-building", cat: "Capacity Building", activity: "State office officer capacity session" },
  { key: "media-parley", cat: "Media Parley/Campaign", activity: "Radio media parley on NHIA benefits" },
];

async function seedEnrolmentDriveMonth(geo, year, month) {
  let createdCount = 0;
  const d = String(month).padStart(2, "0");
  for (const drive of DRIVE_TYPES) {
    if (month % 2 === 0 && drive.key !== "advocacy" && drive.key !== "community-sensitization") continue;
    const ref = `EDR-${drive.key.slice(0, 6).toUpperCase()}-${year}-${geo.code}-${d}`;
    const [report, created] = await EnrolmentDriveReport.findOrCreate({
      where: { reference_id: ref },
      defaults: {
        ...reportHeader(geo, year, month),
        reference_id: ref,
        drive_type: drive.key,
        planned_activities: 2,
      },
    });
    if (!created) continue;
    createdCount += 1;
    await EnrolmentDriveReportLine.bulkCreate([
      {
        report_id: report.id,
        drive_code: "E-001",
        activity_date: `${year}-${d}-10`,
        activity_category: drive.cat,
        specific_activity: drive.activity,
        funding_option: "AOP",
        activity_budget: 150000 + month * 5000,
        approved_amount: 140000 + month * 4000,
        target_audience: ["Community", "Enrollees"],
        location_category: "State Capital",
        location_name: geo.label,
        programs_supported: ["GIFSHIP", "OPS"],
        planned_target_audience: 200 + month * 10,
        target_audience_reached: 180 + month * 8,
        leads_generated: 40 + month,
        new_enrolments: 25 + month,
        activity_status: month <= 9 ? "completed" : "planned",
        remarks: `${geo.label} ${drive.key} sample activity`,
      },
    ]);
  }
  return createdCount;
}

async function seedEnrolleeRegisterMonth(geo, year, month) {
  const ref = refId("MER", geo.code, year, month);
  const self_paying = 120 + month * 8;
  const ops = 90 + month * 5;
  const retirees = 40 + month * 2;
  const constituency = 30 + month;
  const gifship = 200 + month * 15;
  const formal_sector = 350 + month * 20;
  const total_lives = self_paying + ops + retirees + constituency + gifship + formal_sector;
  const [, created] = await MonthlyEnrolleeRegister.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...reportHeader(geo, year, month),
      reference_id: ref,
      self_paying, ops, retirees, constituency, gifship, formal_sector, total_lives,
    },
  });
  return created ? 1 : 0;
}

async function seedIctSupportMonth(geo, year, month) {
  if (month % 2 !== 0) return 0;
  const ref = refId("ICT", geo.code, year, month);
  const [report, created] = await IctSupportReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const d = String(month).padStart(2, "0");
    await IctSupportReportLine.bulkCreate([
      {
        report_id: report.id,
        support_id: `ICT-${geo.code}-${d}-01`,
        date_reported: `${year}-${d}-05`,
        reported_by: SUBMITTED_BY,
        support_category: "Network",
        issue_type: "Connectivity outage",
        description: `Intermittent internet at ${geo.label} state office`,
        priority: "high",
        date_resolved: month <= 9 ? `${year}-${d}-08` : null,
        resolution_status: month <= 9 ? "resolved" : "open",
        action_taken: month <= 9 ? "ISP line reset; router replaced" : null,
        external_support_required: "no",
      },
      {
        report_id: report.id,
        support_id: `ICT-${geo.code}-${d}-02`,
        date_reported: `${year}-${d}-14`,
        reported_by: SUBMITTED_BY,
        support_category: "Application",
        issue_type: "URMS login",
        description: "Staff account locked after password attempts",
        priority: "medium",
        resolution_status: "resolved",
        date_resolved: `${year}-${d}-14`,
        action_taken: "Account unlocked; password reset",
        external_support_required: "no",
      },
    ]);
  }
  return created ? 1 : 0;
}

async function seedAdhocAssignmentMonth(geo, year, month) {
  if (month % 3 !== 0) return 0;
  const ref = refId("ADH", geo.code, year, month);
  const [report, created] = await AdhocAssignmentReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const d = String(month).padStart(2, "0");
    await AdhocAssignmentReportLine.bulkCreate([
      {
        report_id: report.id,
        assignment_id: `ADH-${geo.code}-${d}-01`,
        date_assigned: `${year}-${d}-03`,
        assignment_title: `Special verification visit — ${geo.label}`,
        assigned_by: "State Coordinator",
        assignment_description: "Verify NHIA desk operations at teaching hospital",
        expected_output: "Visit report with findings and photos",
        responsible_unit: "Operations",
        supporting_staff: "Compliance Officer",
        due_date: `${year}-${d}-20`,
        assignment_status: month <= 9 ? "completed" : "in_progress",
        date_completed: month <= 9 ? `${year}-${d}-18` : null,
        output_achieved: month <= 9 ? "Report submitted to zonal office" : null,
        challenges: "Scheduling conflicts with facility management",
        support_required: "Transport",
      },
    ]);
  }
  return created ? 1 : 0;
}

async function seedEtmcQuarter(geo, year, month) {
  const q = quarterFromMonth(month);
  const session = `Q${q}`;
  const ref = refId("ETMC", geo.code, year, month);
  const [report, created] = await EtmcTmcActionPointRegister.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...reportHeader(geo, year, month, "approved"),
      reference_id: ref,
      etmc_session: session,
      meeting_date: `${year}-${String(month).padStart(2, "0")}-15`,
    },
  });
  if (created) {
    await EtmcTmcActionPointLine.bulkCreate([
      {
        report_id: report.id,
        sn: 1,
        agenda_item: "Enrolment performance",
        resolution_id: `RES-${session}-01`,
        resolutions: `Accelerate GIFSHIP enrolment in ${geo.label}`,
        action_point_id: `AP-${session}-01`,
        action_point: "Conduct two community drives before next ETMC",
        timeline: `${year}-${String(Math.min(month + 1, 12)).padStart(2, "0")}-28`,
        responsible_dept: "Operations",
        supporting_dept: "SERVICOM",
        status_update: month <= 9 ? "On track" : "Pending",
      },
      {
        report_id: report.id,
        sn: 2,
        agenda_item: "Provider compliance",
        resolution_id: `RES-${session}-02`,
        resolutions: "Close open compliance findings within 30 days",
        action_point_id: `AP-${session}-02`,
        action_point: "Issue corrective action letters to non-compliant HCFs",
        timeline: `${year}-${String(Math.min(month + 1, 12)).padStart(2, "0")}-20`,
        responsible_dept: "Compliance",
        supporting_dept: "State Coordinator",
        status_update: "In progress",
      },
    ]);
  }
  return created ? 1 : 0;
}

async function seedMysteryShoppingMonth(geo, year, month) {
  if (month % 2 !== 0) return 0;
  const ref = refId("MYS", geo.code, year, month);
  const d = String(month).padStart(2, "0");
  const [, created] = await StateOfficeMysteryShopping.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      reference_id: ref,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year: year,
      reporting_month: month,
      email: `mystery.${geo.code.toLowerCase()}@nhia.gov.ng`,
      mystery_shopper_name: "Demo Mystery Shopper",
      facility_name: `${geo.label} Specialist Hospital`,
      facility_nhia_code: `${geo.code}/001/P`,
      facility_type: "primary_and_secondary",
      facility_email: `hcf.${geo.code.toLowerCase()}@example.com`,
      visit_date: `${year}-${d}-12`,
      observations: {
        reception: "Courteous",
        waiting_time: "Moderate",
        nhia_desk: "Visible and staffed",
      },
      standard_expectations_score: 70 + (month % 5) * 4,
      enrollee_score_1: 75,
      enrollee_score_2: 68,
      enrollee_score_3: 80,
      key_strengths: "Clear NHIA signage; staff able to explain benefits.",
      gaps_identified: "Long queue at pharmacy during peak hours.",
      recommendation: "Add second NHIA desk clerk on clinic days.",
      follow_up_action_plan: "Revisit in 60 days to confirm staffing change.",
      submitted_by: SUBMITTED_BY,
      status: monthStatus(month),
    },
  });
  return created ? 1 : 0;
}

async function seedHmoIndebtednessMonth(geo, year, month) {
  // Seed every month for Kano; other states keep a lighter quarterly cadence
  if (geo.code !== "KAN" && month % 3 !== 0) return 0;
  const ref = refId("HDI", geo.code, year, month);
  const [sheet, created] = await StateOfficeHmoIndebtedness.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      reference_id: ref,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year: year,
      reporting_month: month,
      submitted_by: SUBMITTED_BY,
      status: monthStatus(month),
    },
  });
  if (created) {
    const rows = [
      { hmo_name: "Hygeia HMO", facility_name: `${geo.label} Teaching Hospital`, hcf_code: `${geo.code}/001/P`, nhia_cap: 2500000, nhia_ffs: 800000, phi: 120000 },
      { hmo_name: "Reliance HMO", facility_name: `${geo.label} General Hospital`, hcf_code: `${geo.code}/002/P`, nhia_cap: 1800000, nhia_ffs: 450000, phi: 90000 },
      { hmo_name: "AIICO Multishield", facility_name: `${geo.label} Specialist Clinic`, hcf_code: `${geo.code}/003/P`, nhia_cap: 900000, nhia_ffs: 220000, phi: 40000 },
    ].map((r, i) => ({
      sheet_id: sheet.id,
      ...r,
      total: Number(r.nhia_cap) + Number(r.nhia_ffs) + Number(r.phi),
      sort_order: i + 1,
    }));
    await StateOfficeHmoIndebtednessLine.bulkCreate(rows);
  }
  return created ? 1 : 0;
}

async function seedOfficeProfile(geo, year) {
  const [, created] = await StateZonalOfficeProfile.findOrCreate({
    where: { state_id: geo.state_id, reporting_year: year },
    defaults: {
      reporting_year: year,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      staff_strength: geo.code === "KAN" ? 28 : 18,
      coordinator_name: `${geo.label} State Coordinator`,
      coordinator_phone: "08030000001",
      coordinator_email: `sc.${geo.code.toLowerCase()}@nhia.gov.ng`,
      office_address: `NHIA State Office, ${geo.label}`,
      office_email: `state.${geo.code.toLowerCase()}@nhia.gov.ng`,
      enrolment_target: geo.code === "KAN" ? 120000 : 80000,
      annual_budget: geo.code === "KAN" ? 45000000 : 32000000,
      created_by: SUBMITTED_BY,
    },
  });
  return created ? 1 : 0;
}

async function seedFocalPersons(geo, year) {
  let created = 0;
  const designations = [
    "deputy_director", "assistant_director", "chief_officer", "principal_officer",
    "senior_officer", "officer_i", "officer_ii", "assistant_chief_officer",
  ];
  for (let i = 0; i < FOCAL_DOMAINS.length; i++) {
    const domain = FOCAL_DOMAINS[i];
    const [, wasCreated] = await StateZonalFocalPerson.findOrCreate({
      where: { state_id: geo.state_id, reporting_year: year, domain },
      defaults: {
        reporting_year: year,
        zone_id: geo.zone_id,
        state_id: geo.state_id,
        domain,
        officer_name: `${geo.label} ${domain.replace(/_/g, " ")}`,
        designation: designations[i % designations.length],
        email: `${domain}.${geo.code.toLowerCase()}@nhia.gov.ng`,
        phone: `0803${String(1000000 + i).slice(0, 7)}`,
        created_by: SUBMITTED_BY,
      },
    });
    if (wasCreated) created += 1;
  }
  return created;
}

const KANO_COMPLAINT_TEMPLATES = [
  { against_type: "against_hmo", entity_name: "Hygeia HMO", entity_code: "HMO-HYG", description: "Capitation delay affecting drug availability at AKTH Kano.", status: "escalated", officer: "Mrs. Aisha Ibrahim" },
  { against_type: "against_hcp", entity_name: "Aminu Kano Teaching Hospital", entity_code: "KN/001/P", description: "NHIA desk closed during lunch hours; enrollees turned away.", status: "resolved", officer: "Mr. Musa Bello", notes: "Desk hours extended.", resolved: "2026-02-10" },
  { against_type: "against_hmo", entity_name: "Reliance HMO", entity_code: "HMO-REL", description: "Claim for surgical procedure pending beyond 14 days.", status: "pending", officer: "Mrs. Aisha Ibrahim" },
  { against_type: "against_hcp", entity_name: "Mohammed Abdullahi Wase Specialist Hospital", entity_code: "KN/002/P", description: "Laboratory tests billed to enrollee despite NHIA coverage.", status: "unresolved", officer: "Dr. Sani Yusuf" },
  { against_type: "against_hmo", entity_name: "AIICO Multishield", entity_code: "HMO-AII", description: "Pre-authorization for antenatal care delayed.", status: "resolved", officer: "Mrs. Aisha Ibrahim", notes: "Authorization issued.", resolved: "2026-04-15" },
  { against_type: "against_hcp", entity_name: "National Orthopaedic Hospital, Dala", entity_code: "KN/003/P", description: "Long queue at NHIA verification desk.", status: "pending", officer: "Mr. Musa Bello" },
];

const OTHER_STATES = ["LAG", "OYO", "FCT", "RIV", "IMO", "KAD", "OND"];
const YEAR = 2026;

async function seedStateMonths(geo, months, counts) {
  for (const month of months) {
    counts.enrolment += await seedEnrolmentMonth(geo, YEAR, month);
    counts.migration += await seedMigrationMonth(geo, YEAR, month);
    counts.cemonc += await seedCemoncMonth(geo, YEAR, month);
    counts.igr += await seedIgrMonth(geo, YEAR, month);
    counts.complaintsReport += await seedComplaintsComplianceMonth(geo, YEAR, month);
    counts.accreditation += await seedAccreditationMonth(geo, YEAR, month);
    counts.stakeholder += await seedStakeholderMonth(geo, YEAR, month);
    counts.hmoSelection += await seedHmoSelectionMonth(geo, YEAR, month);
    if (QUARTER_END_MONTHS.includes(month)) {
      counts.sshia += await seedSshiaQuarter(geo, YEAR, month);
      counts.expenditure += await seedExpenditureQuarter(geo, YEAR, month);
      counts.challenges += await seedChallengesQuarter(geo, YEAR, month);
      counts.etmc += await seedEtmcQuarter(geo, YEAR, month);
    }
    counts.weeklyActionable += await seedWeeklyActionableMonth(geo, YEAR, month);
    counts.contractedServices += await seedContractedServicesMonth(geo, YEAR, month);
    counts.enrolmentDrive += await seedEnrolmentDriveMonth(geo, YEAR, month);
    counts.enrolleeRegister += await seedEnrolleeRegisterMonth(geo, YEAR, month);
    counts.ictSupport += await seedIctSupportMonth(geo, YEAR, month);
    counts.adhoc += await seedAdhocAssignmentMonth(geo, YEAR, month);
    counts.mysteryShopping += await seedMysteryShoppingMonth(geo, YEAR, month);
    counts.hmoIndebtedness += await seedHmoIndebtednessMonth(geo, YEAR, month);
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    if (!(await StateOffice.count())) {
      console.error("❌  No states found. Run: npm run db:seed-zones-states");
      process.exit(1);
    }

    console.log("📦  Ensuring State Office tables exist...");
    await syncStateOfficeTables(sequelize, {
      StateOffice, User,
      EnrolmentReport, EnrolmentReportLine,
      MigrationReport, MigrationReportLine,
      CemoncReport, CemoncReportLine,
      IgrReport, IgrReportLine,
      SshiaFinancialReport, SshiaFinancialReportLine,
      ExpenditureProfileReport, ExpenditureProfileReportLine,
      ComplaintsComplianceReport,
      AccreditationReport, AccreditationReportLine,
      StakeholderReport, StakeholderReportLine,
      EnrolmentDriveReport, EnrolmentDriveReportLine,
      HmoSelectionReport, HmoSelectionReportLine,
      ExtraDependantReport, ExtraDependantReportLine,
      HcpChangeReport, HcpChangeReportLine,
      ChallengesReport,
      StateOfficeComplaint,
      StateOfficeComplianceVisit,
      StateOfficeMysteryShopping,
      StateOfficeHmoIndebtedness, StateOfficeHmoIndebtednessLine,
      StateOfficeReconciliationMeeting,
      NhiaAccreditedProvider,
      WeeklyActionableReport, WeeklyActionableReportLine,
      ContractedServicesReport, ContractedServicesReportLine,
      IctSupportReport, IctSupportReportLine,
      AdhocAssignmentReport, AdhocAssignmentReportLine,
      MonthlyEnrolleeRegister,
      EtmcTmcActionPointRegister, EtmcTmcActionPointLine,
    });
    await StateZonalOfficeProfile.sync();
    await StateZonalFocalPerson.sync();

    const purged = await purgeLegacySeedRefs();
    if (purged) console.log(`🧹  Removed ${purged} old SEED-* records`);

    // Point legacy null-module rows at the default sidebar menus so lists aren't empty
    try {
      const [, stkMeta] = await sequelize.query(
        `UPDATE stakeholder_reports SET activity_module = 'engagement-coordination'
         WHERE activity_module IS NULL OR activity_module = ''`,
      );
      const [, accMeta] = await sequelize.query(
        `UPDATE accreditation_reports SET activity_module = 'accreditation'
         WHERE activity_module IS NULL OR activity_module = ''`,
      );
      const stkN = stkMeta?.affectedRows ?? 0;
      const accN = accMeta?.affectedRows ?? 0;
      if (stkN || accN) {
        console.log(`🔗  Tagged ${stkN} stakeholder + ${accN} accreditation report(s) with default activity_module`);
      }
    } catch (err) {
      console.warn("⚠️  activity_module backfill skipped:", err.message);
    }

    const usersFixed = await realignLegacyStateUsers();
    if (usersFixed) console.log(`🔗  Realigned ${usersFixed} user(s) to canonical state IDs`);

    const counts = {
      enrolment: 0, migration: 0, cemonc: 0, igr: 0, sshia: 0, expenditure: 0,
      complaintsReport: 0, accreditation: 0, stakeholder: 0, hmoSelection: 0,
      challenges: 0, enrolleeComplaints: 0, complianceVisits: 0, reconciliation: 0,
      weeklyActionable: 0, contractedServices: 0,
      extraDependant: 0, hcpChange: 0,
      enrolmentDrive: 0, enrolleeRegister: 0, ictSupport: 0, adhoc: 0,
      etmc: 0, mysteryShopping: 0, hmoIndebtedness: 0,
      officeProfiles: 0, focalPersons: 0,
    };

    // ── Kano: full 12 months, rich transactional data (primary demo state) ──
    const kano = await resolveGeo("KAN");
    console.log(`\n📍 Kano (state_id=${kano.state_id}, zone_id=${kano.zone_id})`);
    counts.officeProfiles += await seedOfficeProfile(kano, YEAR);
    counts.focalPersons += await seedFocalPersons(kano, YEAR);
    await seedStateMonths(kano, MONTHS, counts);

    counts.extraDependant += await seedExtraDependantMonth(kano, YEAR, 7, [
      { enrollee_name: "Aisha Bello", principle_nhia_number: "NHIA-KN-10021", age: 7, relationship: "child", program: "Formal Sector", request_date: "2026-07-04", process_end_date: "2026-07-18", line_status: "approved", supporting_documents: [{ name: "birth_certificate.pdf", path: "/uploads/beneficiary/seed-birth-bello.pdf" }] },
      { enrollee_name: "Musa Adeyemi", principle_nhia_number: "NHIA-KN-10021", age: 34, relationship: "spouse", program: "Formal Sector", request_date: "2026-07-04", process_end_date: "2026-07-21", line_status: "pending", supporting_documents: [{ name: "marriage_certificate.pdf", path: "/uploads/beneficiary/seed-marriage-adeyemi.pdf" }] },
    ]);
    counts.extraDependant += await seedExtraDependantMonth(kano, YEAR, 8, [
      { enrollee_name: "Fatima Yusuf", principle_nhia_number: "NHIA-KN-11880", age: 62, relationship: "parent", program: "Retirees", request_date: "2026-08-11", process_end_date: null, line_status: "pending", supporting_documents: [{ name: "nin_slip.pdf", path: "/uploads/beneficiary/seed-nin-yusuf.pdf" }] },
      { enrollee_name: "Chinedu Okafor", principle_nhia_number: "NHIA-KN-10904", age: 11, relationship: "child", program: "GIFSHIP", request_date: "2026-08-15", process_end_date: "2026-08-28", line_status: "approved", supporting_documents: [{ name: "birth_certificate.pdf", path: "/uploads/beneficiary/seed-birth-okafor.pdf" }] },
    ]);
    counts.extraDependant += await seedExtraDependantMonth(kano, YEAR, 9, [
      { enrollee_name: "Halima Sani", principle_nhia_number: "NHIA-KN-12210", age: 4, relationship: "child", program: "OPS", request_date: "2026-09-02", process_end_date: "2026-09-12", line_status: "approved", supporting_documents: [] },
      { enrollee_name: "Ibrahim Sani", principle_nhia_number: "NHIA-KN-12210", age: 29, relationship: "spouse", program: "OPS", request_date: "2026-09-02", process_end_date: null, line_status: "pending", supporting_documents: [{ name: "marriage_certificate.pdf", path: "/uploads/beneficiary/seed-marriage-sani.pdf" }, { name: "nin.pdf", path: "/uploads/beneficiary/seed-nin-sani.pdf" }] },
    ]);

    counts.hcpChange += await seedHcpChangeMonth(kano, YEAR, 7, [
      { record_date: "2026-07-06", enrollee_name: "Tunde Adebayo", nhia_number: "NHIA-KN-20011", current_hcp_hmo: "Aminu Kano Teaching Hospital", new_hcp_hmo: "Mohammed Abdullahi Wase Specialist Hospital", reason_for_transfer: "Relocated closer to new workplace", met_criteria: "yes", request_channel: "walk_in", request_date: "2026-07-03", process_end_date: "2026-07-20", line_status: "approved" },
      { record_date: "2026-07-19", enrollee_name: "Kemi Alabi", nhia_number: "NHIA-KN-20044", current_hcp_hmo: "Hygeia HMO", new_hcp_hmo: "AIICO Multishield Ltd.", reason_for_transfer: "Preferred provider network", met_criteria: "yes", request_channel: "online", request_date: "2026-07-14", process_end_date: null, line_status: "pending" },
    ]);
    counts.hcpChange += await seedHcpChangeMonth(kano, YEAR, 8, [
      { record_date: "2026-08-08", enrollee_name: "Ngozi Eze", nhia_number: "NHIA-KN-21090", current_hcp_hmo: "Murtala Muhammad Specialist Hospital", new_hcp_hmo: "Aminu Kano Teaching Hospital", reason_for_transfer: "Specialist referral for chronic care", met_criteria: "yes", request_channel: "walk_in", request_date: "2026-08-05", process_end_date: "2026-08-22", line_status: "approved" },
    ]);
    counts.hcpChange += await seedHcpChangeMonth(kano, YEAR, 9, [
      { record_date: "2026-09-10", enrollee_name: "Sola Akanbi", nhia_number: "NHIA-KN-22103", current_hcp_hmo: "Reliance HMO", new_hcp_hmo: "Avon Healthcare", reason_for_transfer: "Incomplete documentation submitted", met_criteria: "no", request_channel: "online", request_date: "2026-09-07", process_end_date: "2026-09-15", line_status: "incomplete_documentation" },
      { record_date: "2026-09-12", enrollee_name: "Blessing Okon", nhia_number: "NHIA-KN-22188", current_hcp_hmo: "National Orthopaedic Hospital, Dala", new_hcp_hmo: "St. Louis Hospital, Kano", reason_for_transfer: "Did not meet NHIA proximity rule", met_criteria: "no", request_channel: "walk_in", request_date: "2026-09-09", process_end_date: "2026-09-16", line_status: "not_qualified" },
    ]);

    counts.hmoSelection += await seedHmoSelectionSample(kano, YEAR, 7, [
      { mda: "Kano State Internal Revenue Service", selection_date: "2026-07-09", former_hmo: "Hygeia HMO", reason_for_change: "Contract cycle ended", hmos_invited: 6, hmos_attended: 4, hmos_in_attendance: "4", compliance_guideline: "yes", transparent_process: "yes", selected_hmo: "Reliance HMO" },
    ]);
    counts.hmoSelection += await seedHmoSelectionSample(kano, YEAR, 9, [
      { mda: "Kano State Teaching Service Commission", selection_date: "2026-09-04", former_hmo: "AIICO Multishield Ltd.", reason_for_change: "Need wider rural HCP coverage", hmos_invited: 5, hmos_attended: 5, hmos_in_attendance: "5", compliance_guideline: "yes", transparent_process: "yes", selected_hmo: "AXA Mansard Health" },
    ]);
    counts.hmoSelection += await seedHmoSelectionSample(kano, YEAR, 11, [
      { mda: "Kano State Water Board", selection_date: "2026-11-06", former_hmo: "Avon Healthcare", reason_for_change: "Staff dissatisfaction with claims TAT", hmos_invited: 4, hmos_attended: 2, hmos_in_attendance: "2", compliance_guideline: "no", transparent_process: "no", selected_hmo: "Hygeia HMO" },
    ]);

    for (let m = 1; m <= 12; m++) {
      const tpl = KANO_COMPLAINT_TEMPLATES[(m - 1) % KANO_COMPLAINT_TEMPLATES.length];
      counts.enrolleeComplaints += await seedEnrolleeComplaint(kano, YEAR, m, m, tpl);
      counts.complianceVisits += await seedComplianceVisit(
        kano, YEAR, m, 1, "Aminu Kano Teaching Hospital",
        "NHIA desk and claims verification audit", "Documentation reviewed",
      );
      if (m % 2 === 0) {
        counts.complianceVisits += await seedComplianceVisit(
          kano, YEAR, m, 2, "Mohammed Abdullahi Wase Specialist Hospital",
          "Routine provider compliance check", "Minor gaps; corrective plan issued",
        );
      }
      if (m % 3 === 0) {
        counts.reconciliation += await seedReconciliation(
          kano, YEAR, m, 1, "Hygeia HMO", "Aminu Kano Teaching Hospital",
          1200000 + m * 80000, "In progress",
        );
      }
    }

    // ── Other states: Jan–Jun ──
    for (const code of OTHER_STATES) {
      const geo = await resolveGeo(code);
      console.log(`  → ${geo.label} (${code})`);
      counts.officeProfiles += await seedOfficeProfile(geo, YEAR);
      counts.focalPersons += await seedFocalPersons(geo, YEAR);
      await seedStateMonths(geo, MONTHS.slice(0, 6), counts);
    }

    console.log("\n✅  State Office seed complete (new records only):");
    console.log(`   Enrolment reports:        ${counts.enrolment}`);
    console.log(`   Migration reports:        ${counts.migration}`);
    console.log(`   CEmONC reports:           ${counts.cemonc}`);
    console.log(`   IGR reports:              ${counts.igr}`);
    console.log(`   SSHIA financial reports:    ${counts.sshia}`);
    console.log(`   Expenditure profile:      ${counts.expenditure}`);
    console.log(`   Complaints/compliance:    ${counts.complaintsReport}`);
    console.log(`   Accreditation reports:    ${counts.accreditation}`);
    console.log(`   Stakeholder reports:      ${counts.stakeholder}`);
    console.log(`   Enrolment drives:         ${counts.enrolmentDrive}`);
    console.log(`   HMO selection reports:    ${counts.hmoSelection}`);
    console.log(`   Extra dependant reports:  ${counts.extraDependant}`);
    console.log(`   Change of HCP reports:    ${counts.hcpChange}`);
    console.log(`   Challenges reports:       ${counts.challenges}`);
    console.log(`   Enrollee complaints:      ${counts.enrolleeComplaints}`);
    console.log(`   Compliance visits:        ${counts.complianceVisits}`);
    console.log(`   Reconciliation meetings:  ${counts.reconciliation}`);
    console.log(`   Weekly actionable reports: ${counts.weeklyActionable}`);
    console.log(`   Contracted services:      ${counts.contractedServices}`);
    console.log(`   Enrollee registers:       ${counts.enrolleeRegister}`);
    console.log(`   ICT support reports:      ${counts.ictSupport}`);
    console.log(`   Adhoc assignments:        ${counts.adhoc}`);
    console.log(`   ETMC/TMC action points:   ${counts.etmc}`);
    console.log(`   Mystery shopping:         ${counts.mysteryShopping}`);
    console.log(`   HMO indebtedness:         ${counts.hmoIndebtedness}`);
    console.log(`   Office profiles:          ${counts.officeProfiles}`);
    console.log(`   Focal persons:            ${counts.focalPersons}`);
    console.log("   (Admin/HR — run: npm run db:seed-admin-hr)");
    console.log("   (HMO/HCF providers — see seedAccreditedProviders step in db:seed-all)");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    console.error(err);
    process.exit(1);
  }
})();
