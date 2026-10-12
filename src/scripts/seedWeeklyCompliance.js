/**
 * Seed sample Weekly Compliance Reports (Enforcement) for every state.
 * Idempotent: skips facility + week combinations that already exist.
 *
 *   npm run db:seed-weekly-compliance
 *   node src/scripts/seedWeeklyCompliance.js --weeks 6 --per-state 3
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  StateOffice, User, NhiaAccreditedProvider, StateOfficeWeeklyCompliance,
} = require("../models");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const WEEKS = arg("weeks", 5);
const PER_STATE = arg("per-state", 2);

const INDICATORS = [
  { key: "services_without_denial" },
  { key: "illegal_copayments", yesIsBreach: true },
  { key: "benefit_package_adhered" },
  { key: "emergency_without_authorization" },
  { key: "referral_protocols_followed" },
  { key: "prescribed_medicines_available" },
  { key: "nhia_medicines_list_used" },
  { key: "stockout_alternative" },
  { key: "timely_claims_submission" },
  { key: "prompt_payment_receipt" },
  { key: "hmo_disputes", yesIsBreach: true },
];

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

/** Small deterministic PRNG so re-runs produce the same answers. */
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

function buildIndicators(rand, quality) {
  const out = {};
  for (const ind of INDICATORS) {
    const breach = rand() > quality;
    const answer = ind.yesIsBreach ? (breach ? "yes" : "no") : (breach ? "no" : "yes");
    const remarks = breach ? BREACH_REMARKS[ind.key] : (rand() < 0.35 ? OK_REMARKS[ind.key] : "");
    out[ind.key] = { answer, remarks };
  }
  return out;
}

async function providersForState(state, limit) {
  const byAddress = await NhiaAccreditedProvider.findAll({
    where: { provider_type: "hcp", address: { [Op.like]: `%${state.description}%` } },
    limit,
    order: [["id", "ASC"]],
  });
  if (byAddress.length >= limit) return byAddress;
  const extra = await NhiaAccreditedProvider.findAll({
    where: { provider_type: "hcp", id: { [Op.notIn]: byAddress.map((p) => p.id).concat(0) } },
    limit: limit - byAddress.length,
    offset: state.id * 7,
    order: [["id", "ASC"]],
  });
  return [...byAddress, ...extra];
}

async function officerForState(state) {
  const users = await User.findAll({
    where: { state_id: state.id },
    attributes: ["name", "staff_id", "role"],
    order: [["id", "ASC"]],
  });
  return users.find((u) => /^enf-reporting-officer$/i.test(u.role || ""))
    || users.find((u) => /^(enf|enforcement)-/i.test(u.role || ""))
    || users.find((u) => /reporting-officer/i.test(u.role || ""))
    || users[0] || null;
}

async function nextRefSeq() {
  const year = new Date().getFullYear();
  const last = await StateOfficeWeeklyCompliance.findOne({
    where: { reference_id: { [Op.like]: `WCR-${year}-%` } },
    order: [["reference_id", "DESC"]],
  });
  return { year, seq: last ? Number(last.reference_id.split("-")[2]) : 0 };
}

(async () => {
  await sequelize.authenticate();
  await StateOfficeWeeklyCompliance.sync();

  const states = await StateOffice.findAll({ order: [["id", "ASC"]] });
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * i);
    return isoWeek(d);
  });

  let { year, seq } = await nextRefSeq();
  let created = 0;
  let skipped = 0;

  for (const state of states) {
    if (!state.zonal_id) continue;
    const providers = await providersForState(state, PER_STATE);
    const officer = await officerForState(state);
    const officerName = officer?.name || `${state.description} Compliance Officer`;
    const staffId = officer ? ["Compliance Officer", officer.staff_id].filter(Boolean).join(" / ") : "Compliance Officer";

    for (const provider of providers) {
      for (const week of weeks) {
        const exists = await StateOfficeWeeklyCompliance.findOne({
          where: { state_id: state.id, facility_id: String(provider.id), reporting_week: week },
        });
        if (exists) { skipped += 1; continue; }

        const rand = rng(state.id * 100003 + provider.id * 31 + Number(week.slice(-2)));
        const quality = 0.6 + rand() * 0.38;
        const monday = weekMonday(week);
        const submission = new Date(monday);
        submission.setUTCDate(monday.getUTCDate() + 4 + Math.floor(rand() * 3));

        seq += 1;
        await StateOfficeWeeklyCompliance.create({
          reference_id: `WCR-${year}-${String(seq).padStart(5, "0")}`,
          zone_id: state.zonal_id,
          state_id: state.id,
          reporting_year: monday.getUTCFullYear(),
          reporting_month: monday.getUTCMonth() + 1,
          reporting_week: week,
          facility_id: String(provider.id),
          facility_name: provider.name,
          nhia_code: provider.provider_code,
          facility_type: facilityType(provider.facility_type, rand),
          facility_address: provider.address,
          compliance_officer: officerName,
          designation_staff_id: staffId,
          submission_date: submission.toISOString().slice(0, 10),
          indicators: buildIndicators(rand, quality),
          submitted_by: officerName,
          status: "submitted",
        });
        created += 1;
      }
    }
  }

  console.log(`✅  Weekly compliance reports — created ${created}, skipped ${skipped} existing`);
  console.log(`    Weeks: ${weeks.join(", ")} · ${PER_STATE} facilities per state`);
  process.exit(0);
})().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
