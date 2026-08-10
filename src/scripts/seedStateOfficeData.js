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
  HmoSelectionReport, HmoSelectionReportLine,
  ChallengesReport,
  StateOfficeComplaint,
  StateOfficeComplianceVisit,
  StateOfficeReconciliationMeeting,
  NhiaAccreditedProvider,
} = require("../models");
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
  const ref = refId("ACC", geo.code, year, month);
  const [report, created] = await AccreditationReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const n = 2 + Math.floor(month / 3);
    await AccreditationReportLine.bulkCreate([
      { report_id: report.id, indicator: "accreditation_applications", primary_count: n, secondary_count: 1 },
      { report_id: report.id, indicator: "reaccreditation_applications", primary_count: n - 1, secondary_count: 1 },
      { report_id: report.id, indicator: "completed_forms_returned", primary_count: n + 1, secondary_count: 2 },
      { report_id: report.id, indicator: "awaiting_accreditation", primary_count: n, secondary_count: 0 },
      { report_id: report.id, indicator: "awaiting_reaccreditation", primary_count: 1, secondary_count: 1 },
    ]);
  }
  return created ? 1 : 0;
}

async function seedStakeholderMonth(geo, year, month) {
  const ref = refId("STK", geo.code, year, month);
  const [report, created] = await StakeholderReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...reportHeader(geo, year, month), reference_id: ref },
  });
  if (created) {
    const d = String(month).padStart(2, "0");
    await StakeholderReportLine.bulkCreate([
      { report_id: report.id, activity: "NHIA Sensitization Outreach", audience_size: 120 + month * 15, organization: `${geo.label} Ministry of Health`, location: "State Secretariat", activity_date: `${year}-${d}-08`, key_outcomes: "Increased enrollee awareness" },
      { report_id: report.id, activity: "HMO–Provider Engagement", audience_size: 40 + month * 5, organization: "State HMO Forum", location: "NHIA State Office", activity_date: `${year}-${d}-22`, key_outcomes: "Claims timeline harmonized" },
    ]);
  }
  return created ? 1 : 0;
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
      { report_id: report.id, mda: `${geo.label} Civil Service Commission`, selection_date: `${year}-${d}-05`, hmos_in_attendance: "Hygeia HMO, Reliance HMO, AIICO Multishield" },
      { report_id: report.id, mda: `${geo.label} Ministry of Education`, selection_date: `${year}-${d}-18`, hmos_in_attendance: "Avon Healthcare, AXA Mansard Health" },
    ]);
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

const OYO_COMPLAINT_TEMPLATES = [
  { against_type: "against_hmo", entity_name: "Hygeia HMO", entity_code: "HMO-HYG", description: "Capitation delay affecting drug availability at UCH Ibadan.", status: "escalated", officer: "Mrs. Folake Adeyemi" },
  { against_type: "against_hcp", entity_name: "University College Hospital, Ibadan", entity_code: "OY/001/P", description: "NHIA desk closed during lunch hours; enrollees turned away.", status: "resolved", officer: "Mr. Tunde Oladipo", notes: "Desk hours extended.", resolved: "2026-02-10" },
  { against_type: "against_hmo", entity_name: "Reliance HMO", entity_code: "HMO-REL", description: "Claim for surgical procedure pending beyond 14 days.", status: "pending", officer: "Mrs. Folake Adeyemi" },
  { against_type: "against_hcp", entity_name: "Bowen Teaching Hospital", entity_code: "OY/002/P", description: "Laboratory tests billed to enrollee despite NHIA coverage.", status: "unresolved", officer: "Dr. Kunle Adesina" },
  { against_type: "against_hmo", entity_name: "AIICO Multishield", entity_code: "HMO-AII", description: "Pre-authorization for antenatal care delayed.", status: "resolved", officer: "Mrs. Folake Adeyemi", notes: "Authorization issued.", resolved: "2026-04-15" },
  { against_type: "against_hcp", entity_name: "State Hospital, Oyo", entity_code: "OY/003/P", description: "Long queue at NHIA verification desk.", status: "pending", officer: "Mr. Tunde Oladipo" },
];

const OTHER_STATES = ["LAG", "KAN", "FCT", "RIV", "IMO", "KAD", "OND"];
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
    }
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
      HmoSelectionReport, HmoSelectionReportLine,
      ChallengesReport,
      StateOfficeComplaint,
      StateOfficeComplianceVisit,
      StateOfficeReconciliationMeeting,
      NhiaAccreditedProvider,
    });

    const purged = await purgeLegacySeedRefs();
    if (purged) console.log(`🧹  Removed ${purged} old SEED-* records`);

    const usersFixed = await realignLegacyStateUsers();
    if (usersFixed) console.log(`🔗  Realigned ${usersFixed} user(s) to canonical state IDs`);

    const counts = {
      enrolment: 0, migration: 0, cemonc: 0, igr: 0, sshia: 0, expenditure: 0,
      complaintsReport: 0, accreditation: 0, stakeholder: 0, hmoSelection: 0,
      challenges: 0, enrolleeComplaints: 0, complianceVisits: 0,       reconciliation: 0,
    };

    // ── Oyo: full 12 months, rich transactional data ──
    const oyo = await resolveGeo("OYO");
    console.log(`\n📍 Oyo (state_id=${oyo.state_id}, zone_id=${oyo.zone_id})`);
    await seedStateMonths(oyo, MONTHS, counts);

    for (let m = 1; m <= 12; m++) {
      const tpl = OYO_COMPLAINT_TEMPLATES[(m - 1) % OYO_COMPLAINT_TEMPLATES.length];
      counts.enrolleeComplaints += await seedEnrolleeComplaint(oyo, YEAR, m, m, tpl);
      counts.complianceVisits += await seedComplianceVisit(
        oyo, YEAR, m, 1, "University College Hospital, Ibadan",
        "NHIA desk and claims verification audit", "Documentation reviewed",
      );
      if (m % 2 === 0) {
        counts.complianceVisits += await seedComplianceVisit(
          oyo, YEAR, m, 2, "Bowen Teaching Hospital, Ogbomoso",
          "Routine provider compliance check", "Minor gaps; corrective plan issued",
        );
      }
      if (m % 3 === 0) {
        counts.reconciliation += await seedReconciliation(
          oyo, YEAR, m, 1, "Hygeia HMO", "University College Hospital, Ibadan",
          1200000 + m * 80000, "In progress",
        );
      }
    }

    // ── Other states: Jan–Jun ──
    for (const code of OTHER_STATES) {
      const geo = await resolveGeo(code);
      console.log(`  → ${geo.label} (${code})`);
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
    console.log(`   HMO selection reports:    ${counts.hmoSelection}`);
    console.log(`   Challenges reports:       ${counts.challenges}`);
    console.log(`   Enrollee complaints:      ${counts.enrolleeComplaints}`);
    console.log(`   Compliance visits:        ${counts.complianceVisits}`);
    console.log(`   Reconciliation meetings:  ${counts.reconciliation}`);
    console.log("   (HMO/HCF providers — see seedAccreditedProviders step in db:seed-all)");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    console.error(err);
    process.exit(1);
  }
})();
