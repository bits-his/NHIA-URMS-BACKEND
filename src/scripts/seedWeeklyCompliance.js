/**
 * Seed Weekly Compliance reports + indicator child rows.
 * Drops legacy state_office_weekly_compliance when present.
 *
 *   npm run db:seed-weekly-compliance
 *   node src/scripts/seedWeeklyCompliance.js --weeks 6 --per-state 3
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  StateOffice, User, NhiaAccreditedProvider,
  WeeklyComplianceReport, WeeklyComplianceIndicator,
} = require("../models");
const { INDICATORS: CATALOG } = require("../utils/weeklyComplianceTypes");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const WEEKS = arg("weeks", 5);
const PER_STATE = arg("per-state", 2);

const INDICATORS = CATALOG.map((i) => ({
  key: i.indicator_key,
  section_key: i.section_key,
  yesIsBreach: ["illegal_copayments", "hmo_disputes"].includes(i.indicator_key),
}));

const BREACH_REMARKS = {
  services_without_denial: "Enrolees reported waiting over 3 hours before being attended to.",
  illegal_copayments: "Two enrolees charged for laboratory tests covered under the benefit package.",
  benefit_package_adhered: "Some covered drugs were not dispensed; enrolees asked to buy outside.",
  emergency_without_authorization: "Emergency case delayed pending HMO authorization code.",
  referral_protocols_followed: "Referral made without referral slip / authorization code.",
  prescribed_medicines_available: "Antimalarials and antihypertensives out of stock.",
  nhia_medicines_list_used: "Brands outside the NHIA medicines list prescribed.",
  stockout_alternative: "No alternative supply arrangement in place during stock-out.",
  timely_claims_submission: "Claims for previous month not yet submitted to HMO.",
  prompt_payment_receipt: "Capitation for last month not yet received.",
  hmo_disputes: "Dispute with HMO over rejected fee-for-service claims.",
};

const OK_REMARKS = {
  services_without_denial: "Enrolees attended to promptly.",
  illegal_copayments: "No co-payment complaints recorded.",
  benefit_package_adhered: "Services rendered as per benefit package.",
  emergency_without_authorization: "Emergency cases treated immediately.",
  referral_protocols_followed: "Referral register up to date.",
  prescribed_medicines_available: "Pharmacy adequately stocked.",
  nhia_medicines_list_used: "Prescriptions in line with NHIA list.",
  stockout_alternative: "Arrangement with partner pharmacy in place.",
  timely_claims_submission: "Claims submitted within timeline.",
  prompt_payment_receipt: "Capitation received on schedule.",
  hmo_disputes: "No disputes recorded this week.",
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekMonday(week) {
  const [, y, w] = /^(\d{4})-W(\d{1,2})$/.exec(week);
  const jan4 = new Date(Date.UTC(Number(y), 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(w) - 1) * 7);
  return monday;
}

function facilityType(raw, rand) {
  const v = String(raw || "").toLowerCase();
  if (v.includes("faith") || v.includes("mission")) return "Faith-Based";
  if (v.includes("private")) return "Private";
  if (v.includes("public") || v.includes("government") || v.includes("federal")) return "Public";
  return ["Public", "Private", "Private", "Faith-Based"][Math.floor(rand() * 4)];
}

function buildIndicatorRows(rand, quality) {
  return INDICATORS.map((ind, i) => {
    const breach = rand() > quality;
    const answer = ind.yesIsBreach ? (breach ? "yes" : "no") : (breach ? "no" : "yes");
    const remarks = breach ? BREACH_REMARKS[ind.key] : (rand() < 0.35 ? OK_REMARKS[ind.key] : null);
    return {
      sn: i + 1,
      section_key: ind.section_key,
      indicator_key: ind.key,
      answer,
      remarks: remarks || null,
    };
  });
}

async function dropLegacy() {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.dropTable("state_office_weekly_compliance");
    console.log("Dropped state_office_weekly_compliance");
  } catch (_) { /* */ }
}

async function providersForState(state, limit) {
  const byAddress = await NhiaAccreditedProvider.findAll({
    where: { provider_type: "hcp", address: { [Op.like]: `%${state.description}%` } },
    limit,
    order: [["id", "ASC"]],
  });
  if (byAddress.length >= limit) return byAddress;
  const extra = await NhiaAccreditedProvider.findAll({
    where: {
      provider_type: "hcp",
      id: { [Op.notIn]: byAddress.map((p) => p.id).concat(0) },
    },
    limit: limit - byAddress.length,
    order: [["id", "ASC"]],
  });
  return [...byAddress, ...extra];
}

async function officerForState(state) {
  if (!state.code) return null;
  const users = await User.findAll({
    where: { state_code: state.code },
    attributes: ["name", "staff_id", "role"],
    order: [["id", "ASC"]],
  });
  return users.find((u) => /^enf-reporting-officer$/i.test(u.role || ""))
    || users.find((u) => /^(enf|enforcement)-/i.test(u.role || ""))
    || users.find((u) => /reporting-officer/i.test(u.role || ""))
    || users[0]
    || null;
}

async function nextRefSeq() {
  const year = new Date().getFullYear();
  const last = await WeeklyComplianceReport.findOne({
    where: { reference_id: { [Op.like]: `WCR-${year}-%` } },
    order: [["reference_id", "DESC"]],
  });
  return { year, seq: last ? Number(String(last.reference_id).split("-")[2]) : 0 };
}

(async () => {
  await sequelize.authenticate();
  await dropLegacy();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!WeeklyComplianceReport || !WeeklyComplianceIndicator) {
    throw new Error("Weekly compliance models not loaded — ensure APPROVED_FORMS['weekly-compliance'] is set");
  }

  const states = await StateOffice.findAll({ order: [["code", "ASC"]] });
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * i);
    return isoWeek(d);
  });

  let { year, seq } = await nextRefSeq();
  let created = 0;
  let skipped = 0;

  for (const state of states) {
    const zonal = state.zonal_code;
    if (!zonal) continue;
    const providers = await providersForState(state, PER_STATE);
    const officer = await officerForState(state);
    const officerName = officer?.name || `${state.description} Compliance Officer`;
    const staffId = officer
      ? ["Compliance Officer", officer.staff_id].filter(Boolean).join(" / ")
      : "Compliance Officer";

    for (const provider of providers) {
      for (const week of weeks) {
        const nhia = provider.provider_code || null;
        const exists = await WeeklyComplianceReport.findOne({
          where: nhia
            ? { state_code: state.code, reporting_week: week, nhia_code: nhia }
            : { state_code: state.code, reporting_week: week, facility_id: String(provider.id) },
        });
        if (exists) { skipped += 1; continue; }

        const seedBase = (state.code || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const rand = rng(seedBase * 100003 + provider.id * 31 + Number(week.slice(-2)));
        const quality = 0.6 + rand() * 0.38;
        const monday = weekMonday(week);
        const submission = new Date(monday);
        submission.setUTCDate(monday.getUTCDate() + 4 + Math.floor(rand() * 3));
        const month = monday.getUTCMonth() + 1;

        seq += 1;
        const reference_id = `WCR-${year}-${String(seq).padStart(5, "0")}`;
        await WeeklyComplianceReport.create({
          reference_id,
          zonal_code: zonal,
          state_code: state.code,
          reporting_year: monday.getUTCFullYear(),
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          reporting_week: week,
          facility_id: String(provider.id),
          facility_name: provider.name,
          nhia_code: nhia,
          facility_type: facilityType(provider.facility_type, rand),
          facility_address: provider.address,
          compliance_officer: officerName,
          designation_staff_id: staffId,
          submission_date: submission.toISOString().slice(0, 10),
          submitted_by: officerName,
          status: "submitted",
        });

        for (const row of buildIndicatorRows(rand, quality)) {
          await WeeklyComplianceIndicator.create({
            report_reference_id: reference_id,
            ...row,
          });
        }
        created += 1;
      }
    }
  }

  console.log(`Weekly compliance — created ${created}, skipped ${skipped} existing`);
  console.log(`Weeks: ${weeks.join(", ")} · ${PER_STATE} facilities per state`);
  process.exit(0);
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
