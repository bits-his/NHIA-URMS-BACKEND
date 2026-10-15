/**
 * Clear existing Enrolment Activity reports and seed PPT-aligned sample data
 * (one activity line per report).
 *
 *   npm run db:seed-enrolment
 *   node src/scripts/seedEnrolmentActivity.js
 *
 * Optional:
 *   --year 2026
 *   --keep   Skip clear (append only; still skips existing refs)
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { StateOffice, EnrolmentReport, EnrolmentReportLine } = require("../models");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  if (next == null || next.startsWith("--")) return true;
  return next;
};

const YEAR = Number(arg("year", 2026)) || 2026;
const KEEP = Boolean(arg("keep", false));
const SUBMITTED_BY = "State Office Officer";

const STATE_CODES = ["LAG", "KAN", "FCT", "RIV", "KAD", "OYO"];
const isLegacyCode = (code) => /^SO-\d+$/i.test(code || "");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);

const pad = (n) => String(n).padStart(2, "0");

const refId = (code, year, month, seq) =>
  `ENR-${year}-${code}-${pad(month)}-${pad(seq)}`;

async function resolveGeo(stateCode) {
  const candidates = await StateOffice.findAll({
    where: {
      [Op.or]: [
        { code: stateCode },
        { description: { [Op.like]: `%${stateCode === "FCT" ? "Abuja" : stateCode}%` } },
      ],
    },
    order: [["code", "ASC"], ["id", "ASC"]],
  });
  if (!candidates.length) {
    throw new Error(`State not found for ${stateCode}. Ensure zones/states are seeded.`);
  }
  let best = candidates[0];
  for (const s of candidates) {
    if (s.code === stateCode && !isLegacyCode(s.code)) { best = s; break; }
    if (!isLegacyCode(s.code) && isLegacyCode(best.code)) best = s;
  }
  return {
    state_id: best.id,
    zone_id: best.zonal_id,
    label: best.description,
    code: stateCode,
  };
}

function header(geo, year, month, status) {
  return {
    zone_id: geo.zone_id,
    state_id: geo.state_id,
    reporting_year: year,
    reporting_month: month,
    submission_date: status === "draft" ? null : `${year}-${pad(month)}-22`,
    submitted_by: SUBMITTED_BY,
    status,
  };
}

/** Sample activities — mirrors Enrolment.pptx / Excel template shapes */
function sampleLines(geo, year, month) {
  const q = quarterFromMonth(month);
  const day = pad(Math.min(20, 8 + (month % 10)));
  const activityDate = `${year}-${pad(month)}-${day}`;
  const base = 40 + month * 15 + (geo.code.charCodeAt(0) % 17);

  return [
    {
      category: "enrolment",
      activity_code: "ENR-0001",
      activity_date: activityDate,
      enrolment_channel: "NHIA",
      enrolment_type: "Fresh Enrolment",
      program_code: "PRG-0001",
      program_name: "FSSHIP",
      enrolment_category: "Walk-in",
      beneficiary_category: "Principal (FSSHIP)",
      beneficiary_status: "Active",
      funding_option: "Zero-Cost (Statutory Mandate)",
      supporting_evidence: "Enrolment Register",
      enrolment_count: base + 120,
      activity_status: "Completed",
      remarks: `${geo.label} FSSHIP fresh enrolment for ${pad(month)}/${year}`,
      program_details: {
        surname: "Abdullahi",
        first_name: "Fatima",
        state_of_residence: geo.label,
        phone_number: "08031234567",
      },
      quarter: q,
    },
    {
      category: "enrolment",
      activity_code: "ENR-0001",
      activity_date: activityDate,
      enrolment_channel: "NHIA",
      enrolment_type: "Renewal",
      program_code: "PRG-0005",
      program_name: "GIFSHIP-G",
      enrolment_category: "Group",
      beneficiary_category: "Group (GIFSHIP, GIFSHIP-R)",
      beneficiary_status: "Due for Renewal",
      funding_option: "Budgeted (Approved Release)",
      supporting_evidence: "Payment Schedule",
      activity_budget: 250000,
      approved_amount: 250000,
      enrolment_count: Math.round(base * 0.6),
      activity_status: "In Progress",
      remarks: `GIFSHIP-G renewal window — ${geo.label}`,
      program_details: {
        sponsor_name: `${geo.label} Cooperative Society`,
        enrolment_date_auto: activityDate,
        renewal_status: "Due Soon",
      },
      quarter: q,
    },
    {
      category: "nin_validation",
      activity_code: "ENR-0002",
      activity_date: activityDate,
      enrolment_channel: "NHIA",
      program_code: "PRG-0001",
      program_name: "FSSHIP",
      enrolment_count: 0,
      activity_status: "Validated",
      remarks: `NIN validation desk — ${geo.label}`,
      program_details: {
        enrollee_name: "Musa Ibrahim",
        organization_name: `${geo.label} State Secretariat`,
        nin_number: `1234567890${(month % 10)}`,
        validation_status: "Validated",
        validation_date: activityDate,
      },
      quarter: q,
    },
    {
      category: "id_card_issuance",
      activity_code: "ENR-0003",
      activity_date: activityDate,
      enrolment_channel: "NHIA",
      program_code: "PRG-0002",
      program_name: "BHCPF",
      enrolment_count: 0,
      activity_status: "Issued",
      remarks: `ID card issuance — ${geo.label}`,
      program_details: {
        enrollee_name: "Amina Yusuf",
        request_category: "Fresh Issue",
        nhia_number: `NHIA/${geo.code}/00${month}`,
        id_card_status: "Issued",
        issue_date: activityDate,
      },
      quarter: q,
    },
    {
      category: "validation_of_enrolees",
      activity_code: "ENR-0004",
      activity_date: activityDate,
      enrolment_channel: "SSHIA",
      program_name: "Formal Sector",
      funding_option: "Zero-Cost (Statutory Mandate)",
      enrolment_count: 0,
      enrollees_validated: base * 8,
      activity_status: "Completed",
      remarks: `Enrolee record validation — ${geo.label}`,
      program_details: {
        organization_name: `${geo.label} Ministry of Health`,
      },
      quarter: q,
    },
  ];
}

async function clearEnrolmentData() {
  // Lines first in case FK cascade is not enforced on the DB
  const lines = await EnrolmentReportLine.destroy({ where: {}, truncate: false });
  const reports = await EnrolmentReport.destroy({ where: {}, truncate: false });
  return { lines, reports };
}

async function seedOne(geo, year, month, seq, line, status) {
  const reference_id = refId(geo.code, year, month, seq);
  const existing = await EnrolmentReport.findOne({ where: { reference_id } });
  if (existing) return 0;

  const report = await EnrolmentReport.create({
    ...header(geo, year, month, status),
    reference_id,
  });
  await EnrolmentReportLine.create({
    report_id: report.id,
    ...line,
  });
  return 1;
}

async function main() {
  console.log(`\nEnrolment Activity seed — year ${YEAR}`);
  await sequelize.authenticate();

  let cleared = { lines: 0, reports: 0 };
  if (!KEEP) {
    cleared = await clearEnrolmentData();
    console.log(`Cleared ${cleared.reports} reports and ${cleared.lines} lines`);
  } else {
    console.log("Keeping existing data (--keep)");
  }

  const geos = [];
  for (const code of STATE_CODES) {
    try {
      geos.push(await resolveGeo(code));
    } catch (err) {
      console.warn(`  skip ${code}: ${err.message}`);
    }
  }
  if (!geos.length) {
    throw new Error("No states resolved. Seed zones/states first.");
  }

  // Months: a mix of approved / submitted / draft
  const months = [
    { month: 7, status: "approved" },
    { month: 8, status: "approved" },
    { month: 9, status: "submitted" },
    { month: 10, status: "draft" },
  ];

  let created = 0;
  for (const geo of geos) {
    for (const { month, status } of months) {
      const lines = sampleLines(geo, YEAR, month);
      for (let i = 0; i < lines.length; i += 1) {
        created += await seedOne(geo, YEAR, month, i + 1, lines[i], status);
      }
    }
    console.log(`  ${geo.label} (${geo.code}): seeded`);
  }

  console.log(`\nDone. Created ${created} enrolment activity reports.`);
  console.log(`States: ${geos.map((g) => g.code).join(", ")}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err.message);
  try { await sequelize.close(); } catch { /* ignore */ }
  process.exit(1);
});
