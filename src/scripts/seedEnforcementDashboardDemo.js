/**
 * Seed Compliance + Complaints demo data so the Director Enforcement
 * Dashboard KPIs, drills, and zone/state/facility views are fully populated.
 *
 * Idempotent — upserts by reference_id / complaint_number.
 *
 *   node src/scripts/seedEnforcementDashboardDemo.js
 *   npm run db:seed-enforcement-dashboard
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");
const {
  ComplianceReport,
  ComplianceFinding,
  ComplianceViolation,
  ComplianceEnforcementAction,
} = require("../models");

const YEAR = new Date().getFullYear();

/** Align with complaint demo facilities so typeahead + by-facility charts line up. */
const SITES = [
  { zone_id: 1, state_id: 3, facility_name: "Aminu Kano Teaching Hospital", facility_code: "KN/AKTH", facility_type: "Tertiary", ownership: "Public", code: "NW-KAN" },
  { zone_id: 1, state_id: 2, facility_name: "Barau Dikko Teaching Hospital", facility_code: "KD/BDTH", facility_type: "Tertiary", ownership: "Public", code: "NW-KAD" },
  { zone_id: 1, state_id: 3, facility_name: "Murtala Muhammed Specialist Hospital", facility_code: "KN/MMSH", facility_type: "Secondary", ownership: "Public", code: "NW-MMS" },
  { zone_id: 2, state_id: 9, facility_name: "Abubakar Tafawa Balewa University Teaching Hospital", facility_code: "BA/ATBU", facility_type: "Tertiary", ownership: "Public", code: "NE-BAU" },
  { zone_id: 2, state_id: 9, facility_name: "Specialist Hospital Bauchi", facility_code: "BA/SHB", facility_type: "Secondary", ownership: "Public", code: "NE-SHB" },
  { zone_id: 2, state_id: 8, facility_name: "Federal Medical Centre Yola", facility_code: "AD/FMC", facility_type: "Tertiary", ownership: "Public", code: "NE-YOL" },
  { zone_id: 3, state_id: 20, facility_name: "National Hospital Abuja", facility_code: "FC/NHA", facility_type: "Tertiary", ownership: "Public", code: "NC-NHA" },
  { zone_id: 3, state_id: 20, facility_name: "Gwagwalada Specialist Hospital", facility_code: "FC/GSH", facility_type: "Secondary", ownership: "Public", code: "NC-GSH" },
  { zone_id: 3, state_id: 14, facility_name: "Benue State University Teaching Hospital", facility_code: "BN/BSU", facility_type: "Tertiary", ownership: "Public", code: "NC-BSU" },
  { zone_id: 3, state_id: 14, facility_name: "Federal Medical Centre Makurdi", facility_code: "BN/FMC", facility_type: "Tertiary", ownership: "Public", code: "NC-FMC" },
  { zone_id: 4, state_id: 22, facility_name: "Lagos University Teaching Hospital", facility_code: "LA/LUTH", facility_type: "Tertiary", ownership: "Public", code: "SW-LUT" },
  { zone_id: 4, state_id: 22, facility_name: "Lagos State University Teaching Hospital", facility_code: "LA/LASU", facility_type: "Tertiary", ownership: "Public", code: "SW-LAS" },
  { zone_id: 4, state_id: 26, facility_name: "University College Hospital Ibadan", facility_code: "OY/UCH", facility_type: "Tertiary", ownership: "Public", code: "SW-UCH" },
  { zone_id: 5, state_id: 31, facility_name: "Federal Medical Centre Owerri", facility_code: "IM/FMC", facility_type: "Tertiary", ownership: "Public", code: "SE-FMC" },
  { zone_id: 5, state_id: 31, facility_name: "Imo State University Teaching Hospital", facility_code: "IM/IMS", facility_type: "Tertiary", ownership: "Public", code: "SE-IMS" },
  { zone_id: 5, state_id: 30, facility_name: "University of Nigeria Teaching Hospital", facility_code: "EN/UNTH", facility_type: "Tertiary", ownership: "Public", code: "SE-UNT" },
  { zone_id: 6, state_id: 37, facility_name: "University of Port Harcourt Teaching Hospital", facility_code: "RI/UPTH", facility_type: "Tertiary", ownership: "Public", code: "SS-UPT" },
  { zone_id: 6, state_id: 32, facility_name: "University of Uyo Teaching Hospital", facility_code: "AK/UUTH", facility_type: "Tertiary", ownership: "Public", code: "SS-UYO" },
  { zone_id: 6, state_id: 36, facility_name: "University of Benin Teaching Hospital", facility_code: "ED/UBTH", facility_type: "Tertiary", ownership: "Public", code: "SS-UBT" },
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

function weekForIndex(i) {
  return 20 + (i % 20);
}

function quarterFromWeek(week) {
  return Math.min(4, Math.ceil(Number(week) / 13) || 1);
}

function pickFindings(i) {
  // Rotate so every site has a mix of fully / partially / non
  const base = i % FINDING_POOL.length;
  const selected = [
    FINDING_POOL[base],
    FINDING_POOL[(base + 2) % FINDING_POOL.length],
    FINDING_POOL[(base + 4) % FINDING_POOL.length],
  ];
  // Ensure all three statuses appear across the set; force one of each on every 3rd site
  if (i % 3 === 0) {
    return [
      { ...FINDING_POOL[0] },
      { ...FINDING_POOL[1] },
      { ...FINDING_POOL[3] },
    ];
  }
  return selected.map((f) => ({ ...f }));
}

async function upsertComplianceReport(site, index) {
  const week = weekForIndex(index);
  const reference_id = `ENF-${site.code}-${YEAR}-W${String(week).padStart(2, "0")}`;
  const withViolations = index % 2 === 0;
  const withStrongEnforcement = index % 3 !== 2;
  const status = index % 5 === 4 ? "approved" : "submitted";

  const header = {
    zone_id: site.zone_id,
    state_id: site.state_id,
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
    facility_address: `${site.facility_name}, Nigeria`,
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
    console.log(`  ${created ? "✅" : "↻"}  ${reference_id} — ${site.facility_name} (${status})`);
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
    const result = await upsertComplianceReport(SITES[i], i);
    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else skipped += 1;
  }
  console.log(`\n✅  Compliance demo: ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ""} (year ${YEAR})`);
  return { created, updated, skipped };
}

async function seedComplaints() {
  // Reuse existing complaint demos (SLA + facility enrichment / South South).
  const { seedServicomComplaintsSlaDemo } = require("./seedServicomComplaintsSlaDemo");
  await seedServicomComplaintsSlaDemo();

  // Run facility enrichment + extra rows by spawning the standalone script body.
  // Inline require of the IIFE file is awkward — execute key patches via child.
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
