/**
 * Seed Compliance + Complaints demo data so the Director Enforcement
 * Dashboard KPIs, drills, and zone/state/facility views are fully populated.
 *
 * Resolves zone/state by code/name (never hardcodes numeric IDs) so local and
 * production databases stay aligned.
 *
 * Idempotent — upserts by reference_id / complaint_number.
 *
 *   node src/scripts/seedEnforcementDashboardDemo.js
 *   npm run db:seed-enforcement-dashboard
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
require("../models/index");
const {
  ComplianceReport,
  ComplianceFinding,
  ComplianceViolation,
  ComplianceEnforcementAction,
  StateOffice,
} = require("../models");

const YEAR = new Date().getFullYear();

const STATE_LABELS = {
  KAN: "Kano",
  KAD: "Kaduna",
  BAU: "Bauchi",
  ADA: "Adamawa",
  FCT: "FCT (Abuja)",
  BEN: "Benue",
  LAG: "Lagos",
  OYO: "Oyo",
  IMO: "Imo",
  ENU: "Enugu",
  RIV: "Rivers",
  AKW: "Akwa Ibom",
  EDO: "Edo",
};

/** Align with complaint demo facilities so typeahead + by-facility charts line up. */
const SITES = [
  { state_code: "KAN", facility_name: "Aminu Kano Teaching Hospital", facility_code: "KN/AKTH", facility_type: "Tertiary", ownership: "Public", code: "NW-KAN" },
  { state_code: "KAD", facility_name: "Barau Dikko Teaching Hospital", facility_code: "KD/BDTH", facility_type: "Tertiary", ownership: "Public", code: "NW-KAD" },
  { state_code: "KAN", facility_name: "Murtala Muhammed Specialist Hospital", facility_code: "KN/MMSH", facility_type: "Secondary", ownership: "Public", code: "NW-MMS" },
  { state_code: "BAU", facility_name: "Abubakar Tafawa Balewa University Teaching Hospital", facility_code: "BA/ATBU", facility_type: "Tertiary", ownership: "Public", code: "NE-BAU" },
  { state_code: "BAU", facility_name: "Specialist Hospital Bauchi", facility_code: "BA/SHB", facility_type: "Secondary", ownership: "Public", code: "NE-SHB" },
  { state_code: "ADA", facility_name: "Federal Medical Centre Yola", facility_code: "AD/FMC", facility_type: "Tertiary", ownership: "Public", code: "NE-YOL" },
  { state_code: "FCT", facility_name: "National Hospital Abuja", facility_code: "FC/NHA", facility_type: "Tertiary", ownership: "Public", code: "NC-NHA" },
  { state_code: "FCT", facility_name: "Gwagwalada Specialist Hospital", facility_code: "FC/GSH", facility_type: "Secondary", ownership: "Public", code: "NC-GSH" },
  { state_code: "BEN", facility_name: "Benue State University Teaching Hospital", facility_code: "BN/BSU", facility_type: "Tertiary", ownership: "Public", code: "NC-BSU" },
  { state_code: "BEN", facility_name: "Federal Medical Centre Makurdi", facility_code: "BN/FMC", facility_type: "Tertiary", ownership: "Public", code: "NC-FMC" },
  { state_code: "LAG", facility_name: "Lagos University Teaching Hospital", facility_code: "LA/LUTH", facility_type: "Tertiary", ownership: "Public", code: "SW-LUT" },
  { state_code: "LAG", facility_name: "Lagos State University Teaching Hospital", facility_code: "LA/LASU", facility_type: "Tertiary", ownership: "Public", code: "SW-LAS" },
  { state_code: "OYO", facility_name: "University College Hospital Ibadan", facility_code: "OY/UCH", facility_type: "Tertiary", ownership: "Public", code: "SW-UCH" },
  { state_code: "IMO", facility_name: "Federal Medical Centre Owerri", facility_code: "IM/FMC", facility_type: "Tertiary", ownership: "Public", code: "SE-FMC" },
  { state_code: "IMO", facility_name: "Imo State University Teaching Hospital", facility_code: "IM/IMS", facility_type: "Tertiary", ownership: "Public", code: "SE-IMS" },
  { state_code: "ENU", facility_name: "University of Nigeria Teaching Hospital", facility_code: "EN/UNTH", facility_type: "Tertiary", ownership: "Public", code: "SE-UNT" },
  { state_code: "RIV", facility_name: "University of Port Harcourt Teaching Hospital", facility_code: "RI/UPTH", facility_type: "Tertiary", ownership: "Public", code: "SS-UPT" },
  { state_code: "AKW", facility_name: "University of Uyo Teaching Hospital", facility_code: "AK/UUTH", facility_type: "Tertiary", ownership: "Public", code: "SS-UYO" },
  { state_code: "EDO", facility_name: "University of Benin Teaching Hospital", facility_code: "ED/UBTH", facility_type: "Tertiary", ownership: "Public", code: "SS-UBT" },
];

const FINDING_POOL = [
  { section: "Service Delivery", indicator: "Enrollees received services without denial or delays", status: "fully_compliant" },
  { section: "Service Delivery", indicator: "Waiting time within Standard Treatment Protocol", status: "partially_compliant", remarks: "Peak-hour delays observed" },
  { section: "Medicines & Consumables", indicator: "Essential medicines available for NHIA enrollees", status: "fully_compliant" },
  { section: "Medicines & Consumables", indicator: "Prescribed medicines dispensed without illegal charges", status: "non_compliant", remarks: "Co-payment beyond schedule" },
  { section: "Provider-HMO Interface", indicator: "Claims submitted within stipulated timelines", status: "partially_compliant", remarks: "2 batches late" },
  { section: "Provider-HMO Interface", indicator: "No unresolved HMO disputes affecting care", status: "non_compliant", remarks: "Capitation dispute open" },
  { section: "Records & Documentation", indicator: "Standard medical records maintained for enrollees", status: "fully_compliant" },
  { section: "Records & Documentation", indicator: "NHIA desk register complete and up to date", status: "partially_compliant", remarks: "Missing entries for 3 days" },
];

const VIOLATION_POOL = [
  { nature_of_violation: "Illegal co-payment / fee charging", nhia_act_section: "HCF-5.5.3", occurrences: 2, action_taken: "Written notice issued" },
  { nature_of_violation: "Denial / delay of covered services", nhia_act_section: "HCF-5.5.31", occurrences: 1, action_taken: "Site counselling" },
  { nature_of_violation: "False / inflated claims to HMO", nhia_act_section: "HCF-5.5.4", occurrences: 3, action_taken: "Records seized for review" },
];

const ENFORCEMENT_POOL = [
  { enforcement_action: "Written Compliance Notice Issued", details: "7-day corrective action plan requested" },
  { enforcement_action: "Suspension of Capitation Recommended", details: "Escalated to Enforcement Department" },
  { enforcement_action: "On-site Monitoring Intensified", details: "Weekly follow-up visits scheduled" },
];

async function resolveGeo(stateCode) {
  const byCode = await StateOffice.findOne({ where: { code: stateCode } });
  if (byCode) return { state_id: byCode.id, zone_id: byCode.zonal_id, label: byCode.description };

  const label = STATE_LABELS[stateCode];
  if (!label) throw new Error(`Unknown state code: ${stateCode}`);

  let byDesc = await StateOffice.findOne({ where: { description: label } });
  if (!byDesc) {
    const token = label.replace(/\s*\([^)]*\)\s*/g, "").trim();
    byDesc = await StateOffice.findOne({
      where: { description: { [Op.like]: `%${token}%` } },
      order: [["id", "DESC"]],
    });
  }
  if (!byDesc) {
    throw new Error(`State not found for ${stateCode} (${label}). Run: npm run db:seed-zones-states`);
  }
  return { state_id: byDesc.id, zone_id: byDesc.zonal_id, label: byDesc.description };
}

function weekForIndex(i) {
  return 20 + (i % 20);
}

function quarterFromWeek(week) {
  return Math.min(4, Math.ceil(Number(week) / 13) || 1);
}

function pickFindings(i) {
  const base = i % FINDING_POOL.length;
  const selected = [
    FINDING_POOL[base],
    FINDING_POOL[(base + 2) % FINDING_POOL.length],
    FINDING_POOL[(base + 4) % FINDING_POOL.length],
  ];
  if (i % 3 === 0) {
    return [
      { ...FINDING_POOL[0] },
      { ...FINDING_POOL[1] },
      { ...FINDING_POOL[3] },
    ];
  }
  return selected.map((f) => ({ ...f }));
}

async function upsertComplianceReport(site, geo, index) {
  const week = weekForIndex(index);
  const reference_id = `ENF-${site.code}-${YEAR}-W${String(week).padStart(2, "0")}`;
  const withViolations = index % 2 === 0;
  const withStrongEnforcement = index % 3 !== 2;
  const status = index % 5 === 4 ? "approved" : "submitted";

  const header = {
    zone_id: geo.zone_id,
    state_id: geo.state_id,
    reporting_year: YEAR,
    reporting_week: week,
    reporting_quarter: quarterFromWeek(week),
    officer_name: "Compliance Field Officer",
    officer_staff_id: "DO-ENF-01",
    date_submitted: `${YEAR}-${String(3 + (index % 6)).padStart(2, "0")}-${String(10 + (index % 18)).padStart(2, "0")}`,
    reviewed_by: "State Compliance Lead",
    compliance_status_confirmed: withViolations ? "no" : "yes",
    follow_up_required: withViolations,
    certification: "I certify that this report reflects the compliance visit findings.",
    facility_name: site.facility_name,
    facility_code: site.facility_code,
    facility_type: site.facility_type,
    ownership: site.ownership,
    facility_address: `${site.facility_name}, ${geo.label}, Nigeria`,
    complaints_received: 1 + (index % 4),
    complaint_categories: ["Delay/Denial of Service", "Illegal Charges"].slice(0, 1 + (index % 2)),
    resolved_at_facility: index % 2,
    escalated_to: withViolations ? "enforcement_department" : "state_office",
    complaint_summary: `Demo compliance visit complaints summary for ${site.facility_name}.`,
    state_office_remarks: "Demo seed — CAP / follow-up tracked for Enforcement Dashboard.",
    submitted_by: "Enforcement Demo Seed",
    status,
  };

  const findings = pickFindings(index);
  const violations = withViolations
    ? [VIOLATION_POOL[index % VIOLATION_POOL.length]]
    : [];
  const enforcement_actions = withStrongEnforcement
    ? [ENFORCEMENT_POOL[index % ENFORCEMENT_POOL.length]]
    : [{ enforcement_action: "Written Compliance Notice Issued", details: "Routine advisory" }];

  const t = await sequelize.transaction();
  try {
    let report = await ComplianceReport.findOne({ where: { reference_id }, transaction: t });
    let created = false;
    if (!report) {
      report = await ComplianceReport.create({ reference_id, ...header }, { transaction: t });
      created = true;
    } else {
      await report.update(header, { transaction: t });
      await ComplianceFinding.destroy({ where: { report_id: report.id }, transaction: t });
      await ComplianceViolation.destroy({ where: { report_id: report.id }, transaction: t });
      await ComplianceEnforcementAction.destroy({ where: { report_id: report.id }, transaction: t });
    }

    await ComplianceFinding.bulkCreate(
      findings.map((f) => ({ report_id: report.id, ...f })),
      { transaction: t },
    );
    if (violations.length) {
      await ComplianceViolation.bulkCreate(
        violations.map((v) => ({ report_id: report.id, ...v })),
        { transaction: t },
      );
    }
    await ComplianceEnforcementAction.bulkCreate(
      enforcement_actions.map((e) => ({ report_id: report.id, ...e })),
      { transaction: t },
    );

    await t.commit();
    console.log(`  ${created ? "✅" : "↻"}  ${reference_id} — ${site.facility_name} / ${geo.label} (${status})`);
    return created ? "created" : "updated";
  } catch (err) {
    await t.rollback();
    console.warn(`  ⚠  ${reference_id} skipped: ${err.message}`);
    return "skipped";
  }
}

async function seedCompliance() {
  await ComplianceReport.sync();
  await ComplianceFinding.sync();
  await ComplianceViolation.sync();
  await ComplianceEnforcementAction.sync();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < SITES.length; i += 1) {
    const site = SITES[i];
    let geo;
    try {
      geo = await resolveGeo(site.state_code);
    } catch (err) {
      console.warn(`  ⚠  ${site.facility_name}: ${err.message}`);
      skipped += 1;
      continue;
    }
    const result = await upsertComplianceReport(site, geo, i);
    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else skipped += 1;
  }
  console.log(`\n✅  Compliance demo: ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ""} (year ${YEAR})`);
  return { created, updated, skipped };
}

async function seedComplaints() {
  const { seedServicomComplaintsSlaDemo } = require("./seedServicomComplaintsSlaDemo");
  await seedServicomComplaintsSlaDemo();

  const { spawnSync } = require("child_process");
  const path = require("path");
  const result = spawnSync(process.execPath, [path.join(__dirname, "seedEnforcementComplaintsDemo.js")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("seedEnforcementComplaintsDemo failed");
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("── Complaints (SERVICOM) ──");
    await seedComplaints();
    console.log("\n── Compliance Management ──");
    await seedCompliance();

    const [[comp]] = await sequelize.query(`
      SELECT COUNT(*) AS n FROM compliance_reports WHERE reporting_year = ${YEAR} AND status IN ('submitted','approved')
    `);
    const [[cmp]] = await sequelize.query("SELECT COUNT(*) AS n FROM servicom_complaints");
    const [[fac]] = await sequelize.query(`
      SELECT COUNT(*) AS n FROM servicom_complaints WHERE facility_name IS NOT NULL AND facility_name <> ''
    `);
    console.log(`\n📊  Dashboard-ready: ${comp.n} submitted/approved compliance reports (${YEAR}), ${cmp.n} complaints (${fac.n} with facility)`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
