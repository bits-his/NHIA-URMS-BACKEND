/**
 * Seed realistic SERVICOM dashboard data (comment cards, satisfaction surveys, complaints).
 * Uses current schema: zonal_code / state_code + normalized response rows.
 *
 * Idempotent — removes prior DEMO-* rows, then recreates.
 *
 *   node src/scripts/seedServicomDashboardDemo.js
 *   npm run db:seed-servicom-dashboard
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
require("../models/index");
const {
  StateOffice,
  ServicomCommentCard,
  ServicomCommentCardResponse,
  ServicomSatisfactionSurvey,
  ServicomSatisfactionSurveyResponse,
  ServicomComplaint,
} = require("../models");

const YEAR = 2026;
const PREFIX = {
  card: "CCC-DEMO-",
  survey: "SAT-DEMO-",
  complaint: "ENF-DEMO-",
};

const COMMENT_CARD_QUESTIONS = [
  { id: "Q01", section: "Reception", question: "How would you rate the quality of service received at our reception?", scale: 5 },
  { id: "Q02", section: "Front Desk Staff", question: "Front desk staff are courteous & polite", scale: 4 },
  { id: "Q03", section: "Front Desk Staff", question: "Front desk staff are professional & well-informed", scale: 4 },
  { id: "Q04", section: "Front Desk Staff", question: "Front desk staff are prompt & efficient", scale: 4 },
  { id: "Q05", section: "Overall", question: "Overall rating of the quality of service / interaction within our organisation", scale: 5 },
];

const SATISFACTION_QUESTIONS = [
  { id: "Q01", category: "SERVICE DELIVERY", question: "Are there physical or bureaucratic obstacles to access?" },
  { id: "Q02", category: "SERVICE DELIVERY", question: "Is the facility open for NHIS enrollees only during working hours?" },
  { id: "Q03", category: "SERVICE DELIVERY", question: "Does the HCF recognise poor performance?" },
  { id: "Q04", category: "SERVICE DELIVERY", question: "Does the HCF give honest explanation of the reasons for poor performance?" },
  { id: "Q05", category: "SERVICE DELIVERY", question: "Does the HCF take remedial action for poor performance?" },
  { id: "Q06", category: "TIMELINESS", question: "Are staff seen and perceived to provide prompt service?" },
  { id: "Q07", category: "TIMELINESS", question: "Is there any system in place to monitor waiting time?" },
  { id: "Q08", category: "TIMELINESS", question: "Is there reasonable explanation for delays that are not a regular occurrence?" },
  { id: "Q09", category: "TIMELINESS", question: "Are customers told of any unforeseen interruptions to service?" },
  { id: "Q10", category: "INFORMATION", question: "Does the healthcare facility publish the NHIS drug list?" },
  { id: "Q11", category: "INFORMATION", question: "Does the HCF give enrollees sufficient information with respect to referrals?" },
  { id: "Q12", category: "PROFESSIONALISM", question: "Are appointment procedures clearly detailed at all service points for enrollees to see?" },
  { id: "Q13", category: "PROFESSIONALISM", question: "Do hospital staff adhere to these procedures and give no unfair preference to certain customers?" },
  { id: "Q14", category: "PROFESSIONALISM", question: "Do staff adhere to procedures and there are no hidden costs to enrolees?" },
  { id: "Q15", category: "STAFF ATTITUDE", question: "How sympathetic are hospital staff to enrolee needs?" },
  { id: "Q16", category: "STAFF ATTITUDE", question: "Are staff polite, friendly and attentive to enrolees?" },
  { id: "Q17", category: "STAFF ATTITUDE", question: "Are suitable facilities for privacy available?" },
];

/** Spread across all 6 zones for geo charts. */
const SITES = [
  { state: "KAN", facility: "Aminu Kano Teaching Hospital", strength: "high" },
  { state: "KAD", facility: "Barau Dikko Teaching Hospital", strength: "mid" },
  { state: "JIG", facility: "General Hospital Dutse", strength: "low" },
  { state: "BAU", facility: "Abubakar Tafawa Balewa University Teaching Hospital", strength: "mid" },
  { state: "ADA", facility: "Federal Medical Centre Yola", strength: "low" },
  { state: "FCT", facility: "National Hospital Abuja", strength: "high" },
  { state: "BEN", facility: "Benue State University Teaching Hospital", strength: "mid" },
  { state: "LAG", facility: "Lagos University Teaching Hospital", strength: "high" },
  { state: "OYO", facility: "University College Hospital Ibadan", strength: "mid" },
  { state: "IMO", facility: "Federal Medical Centre Owerri", strength: "mid" },
  { state: "ENU", facility: "University of Nigeria Teaching Hospital", strength: "high" },
  { state: "RIV", facility: "University of Port Harcourt Teaching Hospital", strength: "mid" },
  { state: "EDO", facility: "University of Benin Teaching Hospital", strength: "low" },
  { state: "AKW", facility: "University of Uyo Teaching Hospital", strength: "mid" },
];

const NAMES = [
  "Amina Yusuf", "Chinedu Okeke", "Fatima Bello", "Ibrahim Musa", "Grace Etim",
  "Tunde Adeyemi", "Ngozi Eze", "Halima Sani", "Emeka Nwosu", "Blessing Okoro",
];

const CATEGORIES = ["Billing", "Fraud", "Administrative", "Access", "Communication", "Quality of Care", "Referral", "Staffing & Resources"];
const DOMAINS = [
  { name: "Financial", code: "FIN" },
  { name: "Operational", code: "OPS" },
  { name: "Relationship", code: "REL" },
  { name: "Service Delivery", code: "SVC" },
];
const ROUTES = ["Walk-in", "Phone", "Email", "Letter", "SERVICOM"];
const TYPES = ["HCF", "HMO", "Enrollee"];
const PRIORITIES = ["Top", "High", "Medium"];
const OPEN_STATUSES = [
  "New/Acknowledged",
  "Under Investigation",
  "Awaiting Action From Respondent",
  "Escalated",
];
const CLOSED_STATUSES = ["Resolved", "Closed", "Complaint Withdrawn"];
const OUTCOMES = ["Resolved in favour of complainant", "Resolved in favour of respondent", "Mutual settlement", "Withdrawn"];

/** Deterministic pseudo-random 0..1 from integer seed. */
function rnd(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pick(arr, seed) {
  return arr[Math.floor(rnd(seed) * arr.length) % arr.length];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dateInMonth(year, month, dayHint, seed) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = clamp(dayHint || Math.floor(rnd(seed) * daysInMonth) + 1, 1, daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function scoreProfile(strength, seed) {
  if (strength === "high") return clamp(Math.round(3 + rnd(seed) * 2), 1, 5);
  if (strength === "low") return clamp(Math.round(1 + rnd(seed) * 2), 1, 5);
  return clamp(Math.round(2 + rnd(seed) * 2.5), 1, 5);
}

function yesRate(strength, categoryBias, seed) {
  let base = strength === "high" ? 0.82 : strength === "low" ? 0.38 : 0.62;
  base += categoryBias;
  return rnd(seed) < clamp(base, 0.1, 0.95);
}

async function loadStates() {
  const codes = [...new Set(SITES.map((s) => s.state))];
  const rows = await StateOffice.findAll({ where: { code: { [Op.in]: codes } } });
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
  const missing = codes.filter((c) => !byCode[c]);
  if (missing.length) {
    throw new Error(`Missing state_offices for: ${missing.join(", ")}. Run seedZonesStates first.`);
  }
  return byCode;
}

async function cleanupDemo() {
  const cardIds = (await ServicomCommentCard.findAll({
    where: { reference_id: { [Op.like]: `${PREFIX.card}%` } },
    attributes: ["reference_id"],
  })).map((r) => r.reference_id);

  const surveyIds = (await ServicomSatisfactionSurvey.findAll({
    where: { reference_id: { [Op.like]: `${PREFIX.survey}%` } },
    attributes: ["reference_id"],
  })).map((r) => r.reference_id);

  const complaintIds = (await ServicomComplaint.findAll({
    where: { complaint_number: { [Op.like]: `${PREFIX.complaint}%` } },
    attributes: ["complaint_number"],
  })).map((r) => r.complaint_number);

  if (cardIds.length) {
    await ServicomCommentCardResponse.destroy({ where: { reference_id: { [Op.in]: cardIds } } });
    await ServicomCommentCard.destroy({ where: { reference_id: { [Op.in]: cardIds } } });
  }
  if (surveyIds.length) {
    await ServicomSatisfactionSurveyResponse.destroy({ where: { reference_id: { [Op.in]: surveyIds } } });
    await ServicomSatisfactionSurvey.destroy({ where: { reference_id: { [Op.in]: surveyIds } } });
  }
  if (complaintIds.length) {
    await ServicomComplaint.destroy({ where: { complaint_number: { [Op.in]: complaintIds } } });
  }

  return {
    cards: cardIds.length,
    surveys: surveyIds.length,
    complaints: complaintIds.length,
  };
}

async function seedCommentCards(statesByCode) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let seq = 1;
  let created = 0;

  for (const site of SITES) {
    const state = statesByCode[site.state];
    const cardsPerSite = site.strength === "high" ? 5 : site.strength === "low" ? 3 : 4;

    for (let i = 0; i < cardsPerSite; i += 1) {
      const month = months[(seq + i) % months.length];
      const ref = `${PREFIX.card}${YEAR}-${String(seq).padStart(5, "0")}`;
      const cardDate = dateInMonth(YEAR, month, 5 + i * 3, seq * 17 + i);
      const lines = COMMENT_CARD_QUESTIONS.map((q, qi) => {
        const raw = scoreProfile(site.strength, seq * 31 + qi * 7);
        const value = clamp(raw, 1, q.scale);
        return {
          reference_id: ref,
          question_id: q.id,
          section: q.section,
          question_text: q.question,
          scale_max: q.scale,
          response_value: value,
          score: value,
        };
      });
      const total = lines.reduce((s, l) => s + l.score, 0);
      const average = Number((total / lines.length).toFixed(2));

      await ServicomCommentCard.create({
        reference_id: ref,
        zonal_code: state.zonal_code,
        state_code: state.code,
        unit_code: "SVC-STD",
        card_date: cardDate,
        respondent_name: pick(NAMES, seq * 3),
        organisation: site.facility,
        total_score: total,
        average_score: average,
      });
      await ServicomCommentCardResponse.bulkCreate(lines);
      seq += 1;
      created += 1;
    }
  }
  return created;
}

async function seedSatisfactionSurveys(statesByCode) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  /** Force repeated-low on these Qs in low-strength sites across Q1 and Q2. */
  const repeatedLowQs = new Set(["Q06", "Q07", "Q10"]);
  let seq = 1;
  let created = 0;

  for (const site of SITES) {
    const state = statesByCode[site.state];
    const surveysPerSite = site.strength === "high" ? 4 : 3;

    for (let i = 0; i < surveysPerSite; i += 1) {
      const month = months[(seq + i * 2) % months.length];
      const ref = `${PREFIX.survey}${YEAR}-${String(seq).padStart(5, "0")}`;
      const surveyDate = dateInMonth(YEAR, month, 8 + i * 4, seq * 19 + i);
      const provider = i % 2 === 0
        ? site.facility
        : `${site.facility.split(" ")[0]} Specialist Clinic`;

      const lines = SATISFACTION_QUESTIONS.map((q, qi) => {
        let bias = 0;
        if (q.category === "TIMELINESS") bias = -0.18;
        if (q.category === "STAFF ATTITUDE") bias = 0.12;
        if (q.category === "INFORMATION") bias = -0.08;

        let yes;
        if (site.strength === "low" && repeatedLowQs.has(q.id) && month <= 6) {
          yes = false;
        } else {
          yes = yesRate(site.strength, bias, seq * 41 + qi * 13);
        }

        return {
          reference_id: ref,
          question_id: q.id,
          category: q.category,
          question_text: q.question,
          response_value: yes ? "yes" : "no",
          score: yes ? 1 : 0,
        };
      });

      const total = lines.reduce((s, l) => s + l.score, 0);
      const max = SATISFACTION_QUESTIONS.length;
      const percentage = Number(((total / max) * 100).toFixed(1));

      await ServicomSatisfactionSurvey.create({
        reference_id: ref,
        zonal_code: state.zonal_code,
        state_code: state.code,
        unit_code: "SVC-SAT",
        provider_name: provider,
        survey_date: surveyDate,
        team: [pick(NAMES, seq), pick(NAMES, seq + 5)],
        total_score: total,
        max_score: max,
        percentage_score: percentage,
      });
      await ServicomSatisfactionSurveyResponse.bulkCreate(lines);
      seq += 1;
      created += 1;
    }
  }
  return created;
}

async function seedComplaints(statesByCode) {
  let seq = 1;
  let created = 0;
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (const site of SITES) {
    const state = statesByCode[site.state];
    const count = site.strength === "high" ? 8 : site.strength === "low" ? 5 : 6;

    for (let i = 0; i < count; i += 1) {
      const month = months[(seq + i) % months.length];
      const received = dateInMonth(YEAR, month, 3 + (i % 20), seq * 23 + i);
      const type = pick(TYPES, seq + i);
      const priority = pick(PRIORITIES, seq * 5 + i);
      const domain = pick(DOMAINS, seq * 7 + i);
      const category = pick(CATEGORIES, seq * 11 + i);
      const route = pick(ROUTES, seq * 13 + i);
      const closed = rnd(seq * 17 + i) > 0.38;
      const status = closed
        ? pick(CLOSED_STATUSES, seq + i * 3)
        : pick(OPEN_STATUSES, seq + i * 3);

      const slaDays = priority === "Top" ? 5 : priority === "High" ? 10 : 20;
      let resolution_days = null;
      let resolution_within_sla = null;
      let date_closed = null;
      let outcome = null;

      if (closed) {
        const within = rnd(seq * 29 + i) > 0.35;
        resolution_days = within
          ? clamp(Math.round(1 + rnd(seq) * (slaDays - 1)), 1, slaDays)
          : clamp(Math.round(slaDays + 1 + rnd(seq + 1) * 12), slaDays + 1, slaDays + 15);
        resolution_within_sla = within;
        date_closed = addDays(received, resolution_days);
        outcome = pick(OUTCOMES, seq + i);
      }

      const complaintNumber = `${PREFIX.complaint}${type}/${state.code}/${String(month).padStart(2, "0")}${String(YEAR).slice(2)}/${String(seq).padStart(3, "0")}`;

      await ServicomComplaint.create({
        complaint_number: complaintNumber,
        zonal_code: state.zonal_code,
        state_code: state.code,
        unit_code: "SVC-CMP",
        reporting_month: month,
        reporting_year: YEAR,
        entry_date: received,
        complaint_date: received,
        date_received: received,
        complaint_type: type,
        complaint_against: type,
        complaint_category: category,
        category_code: `${type.slice(0, 3).toUpperCase()}-${category.slice(0, 3).toUpperCase()}-001`,
        complaint_domain: domain.name,
        domain_code: domain.code,
        priority_rating: priority,
        transmission_route: route,
        complainant_category: pick(["Enrollee", "HCF", "HMO", "NHIA Staff"], seq + i),
        complainant_name: pick(NAMES, seq * 2 + i),
        complainant_nhis_id: rnd(seq + i) > 0.7 ? `NHIS-${100000 + seq}` : `NHIS-${200000 + (seq % 40)}`,
        complainant_hcf_name: type === "HCF" ? site.facility : null,
        respondent_category: type === "Enrollee" ? "Healthcare Facility" : type,
        respondent_hcf_name: site.facility,
        officer_assigned: status === "New/Acknowledged" ? null : pick(NAMES, seq + 9),
        investigation_start_date: ["Under Investigation", "Awaiting Action From Respondent", "Escalated", "Resolved", "Closed"].includes(status)
          ? addDays(received, 1)
          : null,
        status,
        escalated: status === "Escalated",
        escalation_level: status === "Escalated" ? "Zonal Office" : null,
        escalation_date: status === "Escalated" ? addDays(received, 4) : null,
        resolution_days,
        resolution_within_sla,
        date_closed,
        outcome,
        description: `${category} complaint against ${site.facility} (${domain.name}).`,
        actions_details: status === "New/Acknowledged" ? null : "Acknowledged and logged for investigation.",
        actions_taken: status === "New/Acknowledged" ? [] : ["Complaint acknowledged"],
      });

      seq += 1;
      created += 1;
    }
  }
  return created;
}

async function main() {
  console.log("Connecting…");
  await sequelize.authenticate();

  const statesByCode = await loadStates();
  console.log(`Resolved ${Object.keys(statesByCode).length} states.`);

  const removed = await cleanupDemo();
  console.log(`Cleaned previous demo rows: cards=${removed.cards}, surveys=${removed.surveys}, complaints=${removed.complaints}`);

  const cards = await seedCommentCards(statesByCode);
  const surveys = await seedSatisfactionSurveys(statesByCode);
  const complaints = await seedComplaints(statesByCode);

  console.log(`Seeded comment cards: ${cards}`);
  console.log(`Seeded satisfaction surveys: ${surveys}`);
  console.log(`Seeded complaints: ${complaints}`);
  console.log("Done. Open SERVICOM dashboard with year=2026.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  console.error(err);
  process.exit(1);
});
