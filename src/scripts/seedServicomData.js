/**
 * Seed realistic SERVICOM sample data: facilities, monitoring visits,
 * assessment scores, KPIs, findings, recommendations, and complaints.
 * Idempotent — safe to re-run (uses fixed reference IDs).
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  ZonalOffice, StateOffice,
  ServicomAssessmentIndicator,
  ServicomFacility, MonitoringVisit,
  ServicomAssessmentScore, ServicomKpiRecord,
  ServicomFinding, ServicomRecommendation,
  ServicomComplaint,
  ServicomSatisfactionSurvey,
  ServicomCommentCard,
} = require("../models");
const { computeAssessmentScores, computeKpiMetrics } = require("../utils/servicomScoring");

/** Seed state codes → DB description (works when DB uses SO-XX codes instead of LAG/KAN) */
const STATE_LABELS = {
  LAG: "Lagos",
  KAN: "Kano",
  FCT: "FCT (Abuja)",
  RIV: "Rivers",
  KAD: "Kaduna",
  IMO: "Imo",
  OND: "Ondo",
  ZAM: "Zamfara",
  BAU: "Bauchi",
  BEN: "Benue",
};

async function resolveGeo(stateCode) {
  const byCode = await StateOffice.findOne({ where: { code: stateCode } });
  if (byCode) return { state_id: byCode.id, zone_id: byCode.zonal_id };

  const label = STATE_LABELS[stateCode];
  if (!label) throw new Error(`Unknown state code in seed data: ${stateCode}`);

  let byDesc = await StateOffice.findOne({ where: { description: label } });
  if (!byDesc) {
    const token = label.replace(/\s*\([^)]*\)\s*/g, "").trim();
    byDesc = await StateOffice.findOne({
      where: { description: { [Op.like]: `%${token}%` } },
      order: [["id", "DESC"]],
    });
  }
  if (!byDesc) throw new Error(`State not found for ${stateCode} (${label}). Run: npm run db:seed-zones-states`);

  return { state_id: byDesc.id, zone_id: byDesc.zonal_id };
}

async function ensureFacility(def) {
  const geo = await resolveGeo(def.state_code);
  const [facility] = await ServicomFacility.findOrCreate({
    where: { name: def.name, state_id: geo.state_id },
    defaults: {
      name: def.name,
      facility_type: def.facility_type,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      lga: def.lga,
      address: def.address,
      contact_person: def.contact_person,
      phone: def.phone,
      email: def.email,
      is_active: true,
    },
  });
  return facility;
}

async function buildFacilityMap() {
  let created = 0;
  const map = {};
  for (const def of FACILITIES) {
    const geo = await resolveGeo(def.state_code);
    const [facility, wasCreated] = await ServicomFacility.findOrCreate({
      where: { name: def.name, state_id: geo.state_id },
      defaults: {
        name: def.name,
        facility_type: def.facility_type,
        zone_id: geo.zone_id,
        state_id: geo.state_id,
        lga: def.lga,
        address: def.address,
        contact_person: def.contact_person,
        phone: def.phone,
        email: def.email,
        is_active: true,
      },
    });
    map[def.name] = facility;
    if (wasCreated) created++;
  }
  return { map, created };
}

const FACILITIES = [
  {
    name: "Lagos University Teaching Hospital",
    facility_type: "tertiary",
    state_code: "LAG",
    lga: "Surulere",
    address: "1-3 Oba Akinjobi Street, Idi-Araba, Lagos",
    contact_person: "Dr. Wale Okonkwo",
    phone: "08031234567",
    email: "servicom@luth.gov.ng",
  },
  {
    name: "General Hospital Ikeja",
    facility_type: "secondary",
    state_code: "LAG",
    lga: "Ikeja",
    address: "1-3 Oba Akinjobi Way, Ikeja, Lagos",
    contact_person: "Mrs. Adaeze Nwosu",
    phone: "08029876543",
    email: "ghikeja@lagosstate.gov.ng",
  },
  {
    name: "Aminu Kano Teaching Hospital",
    facility_type: "tertiary",
    state_code: "KAN",
    lga: "Kano Municipal",
    address: "Zaria Road, Kano",
    contact_person: "Dr. Ibrahim Musa",
    phone: "08034561234",
    email: "servicom@akth.gov.ng",
  },
  {
    name: "National Hospital Abuja",
    facility_type: "tertiary",
    state_code: "FCT",
    lga: "Abuja Municipal",
    address: "Herbert Macaulay Way, Central Business District, Abuja",
    contact_person: "Dr. Fatima Bello",
    phone: "08091122334",
    email: "servicom@nationalhospital.gov.ng",
  },
  {
    name: "University of Port Harcourt Teaching Hospital",
    facility_type: "tertiary",
    state_code: "RIV",
    lga: "Port Harcourt",
    address: "East-West Road, Choba, Port Harcourt",
    contact_person: "Dr. Emeka Diri",
    phone: "08055667788",
    email: "servicom@upth.gov.ng",
  },
  {
    name: "Barau Dikko Teaching Hospital",
    facility_type: "tertiary",
    state_code: "KAD",
    lga: "Kaduna North",
    address: "Kawo Road, Kaduna",
    contact_person: "Dr. Hauwa Suleiman",
    phone: "08033445566",
    email: "servicom@bdth.gov.ng",
  },
  {
    name: "Federal Medical Centre Owerri",
    facility_type: "secondary",
    state_code: "IMO",
    lga: "Owerri Municipal",
    address: "Orlu Road, Owerri",
    contact_person: "Dr. Chinedu Okafor",
    phone: "08077889900",
    email: "servicom@fmcomwerri.gov.ng",
  },
  {
    name: "State Specialist Hospital Akure",
    facility_type: "secondary",
    state_code: "OND",
    lga: "Akure South",
    address: "Ondo Road, Akure",
    contact_person: "Mrs. Bola Adeyemi",
    phone: "08022334455",
    email: "servicom@sshakure.gov.ng",
  },
];

const VISITS = [
  {
    reference_id: "MV-2026-00001",
    facility_name: "Lagos University Teaching Hospital",
    monitoring_type: "routine",
    visit_date: "2026-01-15",
    monitoring_officer: "Mrs. Grace Etim",
    status: "approved",
    submitted_by: "grace.etim@nhia.gov.ng",
    approved_by: "zonal.sdo@nhia.gov.ng",
    scores: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5],
    kpi: {
      enrollees_served: 1240,
      avg_waiting_time_mins: 45,
      complaints_received: 18,
      complaints_resolved: 16,
      claims_within_timeline: 892,
      beneficiary_satisfaction_rate: 82.5,
      facilities_meeting_standards: 11,
    },
    strengths: [
      "SERVICOM charter prominently displayed at all service points",
      "Dedicated complaint desk with trained officers on duty",
      "NHIA enrollee registration materials readily available",
    ],
    challenges: [
      "Peak-hour waiting times exceed the 60-minute target",
      "Limited seating in the outpatient waiting area",
    ],
    recommendations: [
      {
        description: "Deploy additional registration counters during peak hours (8–11 AM)",
        priority: "high",
        responsible_officer: "Hospital Administrator",
        timeline: "2026-03-31",
        status: "in_progress",
      },
      {
        description: "Expand outpatient waiting area seating by 30%",
        priority: "medium",
        responsible_officer: "Works & Maintenance Unit",
        timeline: "2026-06-30",
        status: "open",
      },
    ],
  },
  {
    reference_id: "MV-2026-00002",
    facility_name: "Aminu Kano Teaching Hospital",
    monitoring_type: "follow_up",
    visit_date: "2026-02-08",
    monitoring_officer: "Mr. Yusuf Abdullahi",
    status: "reviewed",
    submitted_by: "yusuf.abdullahi@nhia.gov.ng",
    reviewed_by: "state.sdo@nhia.gov.ng",
    scores: [4, 4, 3, 4, 3, 4, 3, 4, 4, 3, 4, 4, 3, 3, 4],
    kpi: {
      enrollees_served: 980,
      avg_waiting_time_mins: 72,
      complaints_received: 24,
      complaints_resolved: 19,
      claims_within_timeline: 710,
      beneficiary_satisfaction_rate: 71.0,
      facilities_meeting_standards: 8,
    },
    strengths: [
      "Improved complaint resolution turnaround since last visit",
      "Staff professionalism noted during ward rounds",
    ],
    challenges: [
      "Drug stock-outs affecting NHIA-covered prescriptions",
      "Complaint log not consistently updated",
    ],
    recommendations: [
      {
        description: "Establish weekly pharmacy stock review for NHIA formulary items",
        priority: "high",
        responsible_officer: "Chief Pharmacist",
        timeline: "2026-04-15",
        status: "open",
      },
    ],
  },
  {
    reference_id: "MV-2026-00003",
    facility_name: "National Hospital Abuja",
    monitoring_type: "spot_check",
    visit_date: "2026-02-20",
    monitoring_officer: "Dr. Amina Lawal",
    status: "submitted",
    submitted_by: "amina.lawal@nhia.gov.ng",
    scores: [5, 5, 4, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 4, 5],
    kpi: {
      enrollees_served: 1560,
      avg_waiting_time_mins: 38,
      complaints_received: 12,
      complaints_resolved: 12,
      claims_within_timeline: 1105,
      beneficiary_satisfaction_rate: 88.0,
      facilities_meeting_standards: 14,
    },
    strengths: [
      "Excellent visibility of service standards and NHIA guidelines",
      "Digital complaint tracking system in use",
      "Accessible facilities for persons with disabilities",
    ],
    challenges: [
      "Minor delays in claims documentation for secondary referrals",
    ],
    recommendations: [
      {
        description: "Standardize referral documentation checklist for NHIA claims",
        priority: "medium",
        responsible_officer: "HMO Liaison Officer",
        timeline: "2026-05-01",
        status: "open",
      },
    ],
  },
  {
    reference_id: "MV-2026-00004",
    facility_name: "General Hospital Ikeja",
    monitoring_type: "routine",
    visit_date: "2026-03-05",
    monitoring_officer: "Mrs. Grace Etim",
    status: "draft",
    submitted_by: null,
    scores: [3, 3, 2, 3, 2, 3, 2, 3, 3, 2, 3, 3, 2, 2, 3],
    kpi: {
      enrollees_served: 620,
      avg_waiting_time_mins: 95,
      complaints_received: 31,
      complaints_resolved: 14,
      claims_within_timeline: 380,
      beneficiary_satisfaction_rate: 54.0,
      facilities_meeting_standards: 4,
    },
    strengths: [
      "NHIA desk operational during monitoring visit",
    ],
    challenges: [
      "No visible SERVICOM charter at main entrance",
      "Long enrollee waiting times without triage system",
      "Staff attitude complaints from multiple beneficiaries",
      "Incomplete patient records for NHIA claims",
    ],
    recommendations: [
      {
        description: "Install SERVICOM charter and service standards at all entry points",
        priority: "high",
        responsible_officer: "Medical Director",
        timeline: "2026-03-20",
        status: "open",
      },
      {
        description: "Conduct customer service refresher training for frontline staff",
        priority: "high",
        responsible_officer: "HR & Training Unit",
        timeline: "2026-04-30",
        status: "open",
      },
    ],
  },
  {
    reference_id: "MV-2026-00005",
    facility_name: "University of Port Harcourt Teaching Hospital",
    monitoring_type: "special_investigation",
    visit_date: "2026-03-12",
    monitoring_officer: "Mr. Daniel Hart",
    status: "returned",
    submitted_by: "daniel.hart@nhia.gov.ng",
    returned_by: "zonal.sdo@nhia.gov.ng",
    return_reason: "Incomplete KPI data and missing evidence attachments for claims timeline verification.",
    scores: [4, 3, 4, 4, 3, 4, 3, 4, 4, 3, 4, 3, 4, 3, 4],
    kpi: {
      enrollees_served: 870,
      avg_waiting_time_mins: 58,
      complaints_received: 20,
      complaints_resolved: 15,
      claims_within_timeline: null,
      beneficiary_satisfaction_rate: 68.5,
      facilities_meeting_standards: 7,
    },
    strengths: [
      "Records unit maintains organized NHIA enrollee files",
    ],
    challenges: [
      "Claims processing delays beyond NHIA timeline",
      "Complaint desk not staffed on weekends",
    ],
    recommendations: [
      {
        description: "Submit verified claims timeline report with supporting documents",
        priority: "high",
        responsible_officer: "NHIA Desk Officer",
        timeline: "2026-03-25",
        status: "open",
      },
    ],
  },
];

const COMPLAINTS = [
  {
    complaint_number: "SC-2026-00001",
    facility_name: "Lagos University Teaching Hospital",
    state_code: "LAG",
    complaint_date: "2026-01-20",
    category: "delay_in_service",
    description: "Enrollee waited over 3 hours for NHIA card verification before seeing a doctor.",
    status: "resolved",
    assigned_officer: "Mrs. Grace Etim",
    resolution_notes: "Additional verification desk opened. Patient attended same day.",
    resolution_date: "2026-01-22",
    created_by: "enrollee.rep@nhia.gov.ng",
  },
  {
    complaint_number: "SC-2026-00002",
    facility_name: "Aminu Kano Teaching Hospital",
    state_code: "KAN",
    complaint_date: "2026-02-10",
    category: "drug_availability",
    description: "Prescribed NHIA-covered antibiotics unavailable at hospital pharmacy for 5 consecutive days.",
    status: "in_progress",
    assigned_officer: "Mr. Yusuf Abdullahi",
    created_by: "state.officer@nhia.gov.ng",
  },
  {
    complaint_number: "SC-2026-00003",
    facility_name: "General Hospital Ikeja",
    state_code: "LAG",
    complaint_date: "2026-03-06",
    category: "staff_attitude",
    description: "Front desk staff reportedly rude to elderly enrollee seeking NHIA registration assistance.",
    status: "assigned",
    assigned_officer: "Mrs. Grace Etim",
    created_by: "hotline@nhia.gov.ng",
  },
  {
    complaint_number: "SC-2026-00004",
    facility_name: "National Hospital Abuja",
    state_code: "FCT",
    complaint_date: "2026-02-25",
    category: "claims_processing",
    complaint_domain: "Financial",
    description: "HMO claim for surgical procedure pending approval for 6 weeks despite complete documentation.",
    status: "escalated",
    assigned_officer: "Dr. Amina Lawal",
    created_by: "hmo.liaison@nhia.gov.ng",
  },
  {
    complaint_number: "SC-2026-00005",
    facility_name: "Federal Medical Centre Owerri",
    state_code: "IMO",
    complaint_date: "2026-03-01",
    category: "access_to_care",
    description: "Pregnant enrollee denied antenatal booking slot despite valid NHIA coverage.",
    status: "open",
    assigned_officer: null,
    created_by: "enrollee.rep@nhia.gov.ng",
  },
  {
    complaint_number: "SC-2026-00006",
    facility_name: "Barau Dikko Teaching Hospital",
    state_code: "KAD",
    complaint_date: "2026-02-18",
    category: "delay_in_service",
    description: "Laboratory results for NHIA-covered tests delayed beyond 48-hour standard.",
    status: "closed",
    assigned_officer: "Dr. Hauwa Suleiman",
    resolution_notes: "Lab workflow reviewed. New turnaround SLA communicated to staff.",
    resolution_date: "2026-02-28",
    created_by: "state.officer@nhia.gov.ng",
  },
];

/** Satisfaction surveys — percentage_score 0–100 */
const SATISFACTION_SURVEYS = [
  { reference_id: "SAT-2026-00001", state_code: "ZAM", survey_date: "2026-01-15", provider_name: "Ahmadu Bello University Teaching Hospital", percentage_score: 100, total_score: 13, max_score: 13 },
  { reference_id: "SAT-2026-00002", state_code: "LAG", survey_date: "2026-02-08", provider_name: "Lagos University Teaching Hospital", percentage_score: 50, total_score: 7, max_score: 13 },
  { reference_id: "SAT-2026-00003", state_code: "KAD", survey_date: "2026-02-20", provider_name: "Barau Dikko Teaching Hospital", percentage_score: 92, total_score: 12, max_score: 13 },
  { reference_id: "SAT-2026-00004", state_code: "BAU", survey_date: "2026-03-01", provider_name: "Abubakar Tafawa Balewa University Teaching Hospital", percentage_score: 88, total_score: 11, max_score: 13 },
  { reference_id: "SAT-2026-00005", state_code: "BEN", survey_date: "2026-03-05", provider_name: "Benue State University Teaching Hospital", percentage_score: 44, total_score: 6, max_score: 13 },
  { reference_id: "SAT-2026-00006", state_code: "FCT", survey_date: "2026-01-28", provider_name: "National Hospital Abuja", percentage_score: 38, total_score: 5, max_score: 13 },
  { reference_id: "SAT-2026-00007", state_code: "KAN", survey_date: "2026-02-12", provider_name: "Aminu Kano Teaching Hospital", percentage_score: 31, total_score: 4, max_score: 13 },
  { reference_id: "SAT-2026-00008", state_code: "IMO", survey_date: "2026-03-08", provider_name: "Federal Medical Centre Owerri", percentage_score: 23, total_score: 3, max_score: 13 },
];

/** Charter comment cards — average_score 1–5 */
const COMMENT_CARDS = [
  { reference_id: "CCC-2026-00001", state_code: "KAD", card_date: "2026-02-18", organisation: "Kaduna NHIA Office", average_score: 4.8, total_score: 24 },
  { reference_id: "CCC-2026-00002", state_code: "BAU", card_date: "2026-03-02", organisation: "Bauchi State Hospital", average_score: 4.5, total_score: 23 },
  { reference_id: "CCC-2026-00003", state_code: "LAG", card_date: "2026-02-10", organisation: "Lagos NHIA Office", average_score: 3.2, total_score: 16 },
  { reference_id: "CCC-2026-00004", state_code: "BEN", card_date: "2026-03-06", organisation: "Benue NHIA Office", average_score: 2.8, total_score: 14 },
];

async function seedVisit(visitDef, facilityMap, indicators) {
  let facility = facilityMap[visitDef.facility_name];
  if (!facility) {
    const def = FACILITIES.find((f) => f.name === visitDef.facility_name);
    if (def) {
      facility = await ensureFacility(def);
      facilityMap[def.name] = facility;
    }
  }
  if (!facility) {
    console.warn(`  ⚠  Skipping visit ${visitDef.reference_id}: facility not found (${visitDef.facility_name})`);
    return false;
  }

  const [visit, created] = await MonitoringVisit.findOrCreate({
    where: { reference_id: visitDef.reference_id },
    defaults: {
      zone_id: facility.zone_id,
      state_id: facility.state_id,
      facility_id: facility.id,
      lga: facility.lga,
      facility_name: facility.name,
      facility_type: facility.facility_type,
      address: facility.address,
      contact_person: facility.contact_person,
      phone: facility.phone,
      email: facility.email,
      visit_date: visitDef.visit_date,
      monitoring_type: visitDef.monitoring_type,
      monitoring_officer: visitDef.monitoring_officer,
      status: visitDef.status,
      submitted_by: visitDef.submitted_by,
      reviewed_by: visitDef.reviewed_by ?? null,
      approved_by: visitDef.approved_by ?? null,
      returned_by: visitDef.returned_by ?? null,
      return_reason: visitDef.return_reason ?? null,
    },
  });

  if (!created) return false;

  const scoreValues = visitDef.scores.slice(0, indicators.length);
  const assessment = computeAssessmentScores(scoreValues);
  await visit.update(assessment);

  for (let i = 0; i < indicators.length && i < scoreValues.length; i++) {
    await ServicomAssessmentScore.create({
      visit_id: visit.id,
      indicator_id: indicators[i].id,
      score: scoreValues[i],
    });
  }

  if (visitDef.kpi) {
    const metrics = computeKpiMetrics(visitDef.kpi);
    await ServicomKpiRecord.create({ visit_id: visit.id, ...visitDef.kpi, ...metrics });
  }

  for (const desc of visitDef.strengths || []) {
    await ServicomFinding.create({ visit_id: visit.id, finding_type: "strength", description: desc });
  }
  for (const desc of visitDef.challenges || []) {
    await ServicomFinding.create({ visit_id: visit.id, finding_type: "challenge", description: desc });
  }
  for (const rec of visitDef.recommendations || []) {
    await ServicomRecommendation.create({ visit_id: visit.id, ...rec });
  }

  return true;
}

async function seedComplaint(c, facilityMap) {
  const facility = facilityMap[c.facility_name];
  let geo;
  try {
    geo = await resolveGeo(c.state_code);
  } catch (err) {
    console.warn(`  ⚠  Skipping complaint ${c.complaint_number}: ${err.message}`);
    return false;
  }

  const [, created] = await ServicomComplaint.findOrCreate({
    where: { complaint_number: c.complaint_number },
    defaults: {
      complaint_date: c.complaint_date,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      facility_id: facility?.id ?? null,
      facility_name: c.facility_name,
      category: c.category,
      complaint_category: c.category,
      complaint_domain: c.complaint_domain ?? "Service Delivery",
      description: c.description,
      status: c.status,
      assigned_officer: c.assigned_officer,
      resolution_notes: c.resolution_notes ?? null,
      resolution_date: c.resolution_date ?? null,
      created_by: c.created_by,
    },
  });
  return created;
}

async function seedSatisfactionSurvey(row) {
  let geo;
  try {
    geo = await resolveGeo(row.state_code);
  } catch (err) {
    console.warn(`  ⚠  Skipping survey ${row.reference_id}: ${err.message}`);
    return false;
  }
  const [, created] = await ServicomSatisfactionSurvey.findOrCreate({
    where: { reference_id: row.reference_id },
    defaults: {
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      provider_name: row.provider_name,
      survey_date: row.survey_date,
      survey_officers: row.survey_officers ?? "SERVICOM Team",
      responses: row.responses ?? [],
      total_score: row.total_score,
      max_score: row.max_score,
      percentage_score: row.percentage_score,
      created_by: "seed@nhia.gov.ng",
    },
  });
  return created;
}

async function seedCommentCard(row) {
  let geo;
  try {
    geo = await resolveGeo(row.state_code);
  } catch (err) {
    console.warn(`  ⚠  Skipping comment card ${row.reference_id}: ${err.message}`);
    return false;
  }
  const [, created] = await ServicomCommentCard.findOrCreate({
    where: { reference_id: row.reference_id },
    defaults: {
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      organisation: row.organisation ?? null,
      card_date: row.card_date,
      responses: row.responses ?? [],
      total_score: row.total_score,
      average_score: row.average_score,
      created_by: "seed@nhia.gov.ng",
    },
  });
  return created;
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    const states = await StateOffice.findAll();
    if (!states.length) {
      console.error("❌  No states found. Run: npm run db:seed-zones-states");
      process.exit(1);
    }

    const indicators = await ServicomAssessmentIndicator.findAll({
      where: { is_active: true },
      order: [["sort_order", "ASC"]],
    });
    if (!indicators.length) {
      console.error("❌  No indicators found. Run: npm run db:seed-servicom");
      process.exit(1);
    }

    const { map: facilityMap, created: facilitiesCreated } = await buildFacilityMap();
    console.log(`✅  Facilities ready (${Object.keys(facilityMap).length} total, ${facilitiesCreated} new)`);

    let visitsCreated = 0;
    for (const v of VISITS) {
      if (await seedVisit(v, facilityMap, indicators)) visitsCreated++;
    }
    console.log(`✅  Monitoring visits seeded (${visitsCreated} new)`);

    let complaintsCreated = 0;
    for (const c of COMPLAINTS) {
      if (await seedComplaint(c, facilityMap)) complaintsCreated++;
    }
    console.log(`✅  Complaints seeded (${complaintsCreated} new)`);

    let surveysCreated = 0;
    for (const s of SATISFACTION_SURVEYS) {
      if (await seedSatisfactionSurvey(s)) surveysCreated++;
    }
    console.log(`✅  Satisfaction surveys seeded (${surveysCreated} new)`);

    let cardsCreated = 0;
    for (const c of COMMENT_CARDS) {
      if (await seedCommentCard(c)) cardsCreated++;
    }
    console.log(`✅  Comment cards seeded (${cardsCreated} new)`);

    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    console.error(err);
    process.exit(1);
  }
})();
