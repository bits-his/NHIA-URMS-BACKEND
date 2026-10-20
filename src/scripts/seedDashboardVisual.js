/**
 * Varied 2026 sample data so the three unit dashboards show real shape.
 * Idempotent: rows are keyed (AST-VIS-, PP-VIS-, CCC-VIS-, SAT-VIS-, CMP-VIS-)
 * and existing store assets are re-profiled by zone on every run.
 *
 *   node src/scripts/seedDashboardVisual.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const {
  ZonalOffice,
  StateOffice,
  StoreAsset,
  PrepaymentAnalysis,
  ServicomCommentCard,
  ServicomSatisfactionSurvey,
  ServicomComplaint,
} = require("../models");

const COMMENT_QS = ["Q01", "Q02", "Q03", "Q04", "Q05"];
const SURVEY_QS = Array.from({ length: 17 }, (_, i) => `Q${String(i + 1).padStart(2, "0")}`);

const NAMES = [
  "Executive Office Desk", "HP LaserJet Printer", "Split Air Conditioner", "Dell OptiPlex Desktop",
  "Metal Filing Cabinet", "Conference Room Projector", "Lenovo Laptop", "Document Scanner",
  "Office Generator", "Network Server", "Visitor Chair", "Photocopier", "UPS Unit",
  "Office Refrigerator", "Wireless Router", "Pool Vehicle",
];

const CATS = [
  ["Office Furniture", "Desks & Workstations"],
  ["Office Equipment", "Printing & Document Management"],
  ["Office Equipment", "Office Appliances"],
  ["Computer Equipment", "User End-Point Devices"],
  ["Office Furniture", "Storage & Filing Systems"],
  ["Office Equipment", "Telecommunications"],
];

/** c condition, v verification, tag, op status, custodian, overdue maintenance */
const SEQUENCE = {
  "North Central": [
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Fair", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "In Store", true, false],
    ["Obsolete", "Verified & Passed", true, "Obsolete", true, false],
  ],
  "South West": [
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Excellent", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Defective", "Exception", true, "Under Repair", true, true],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Fair", "Verified & Passed", false, "Active (in-use)", true, false],
  ],
  "North West": [
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Defective", "Exception", true, "Under Repair", true, true],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Poor", "Unverified", false, "Active (in-use)", false, false],
    ["Fair", "Verified & Passed", true, "In Store", true, false],
    ["Damaged", "Exception", false, "Under Repair", true, true],
  ],
  "North East": [
    ["Missing", "Missing", false, "Missing", false, false],
    ["Defective", "Unverified", false, "Under Repair", false, true],
    ["Poor", "Unverified", false, "Active (in-use)", false, false],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Damaged", "Exception", false, "Under Repair", true, true],
    ["Poor", "Unverified", false, "In Store", false, false],
  ],
  "South East": [
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Fair", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "In Store", true, false],
    ["Obsolete", "Unverified", false, "Obsolete", true, false],
    ["Retired", "Exception", false, "Retired", true, false],
  ],
  "South South": [
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Good", "Verified & Passed", true, "Active (in-use)", true, false],
    ["Defective", "Exception", true, "Under Repair", true, true],
    ["Fair", "Verified & Passed", false, "Active (in-use)", true, false],
    ["Poor", "Unverified", false, "In Store", true, false],
    ["Missing", "Missing", false, "Missing", false, false],
  ],
};

const EXTRA_BY_STATE = {
  Lagos: 16,
  "FCT (Abuja)": 10,
  Kano: 10,
  Rivers: 8,
  Kaduna: 4,
  Oyo: 6,
  Enugu: 2,
  Borno: 4,
  Edo: 3,
  Anambra: 2,
};

const FACILITIES = {
  Lagos: ["Lagos University Teaching Hospital", "Lagos State University Teaching Hospital", "General Hospital Ikeja"],
  "FCT (Abuja)": ["National Hospital Abuja", "University of Abuja Teaching Hospital"],
  Kano: ["Aminu Kano Teaching Hospital", "Murtala Muhammed Specialist Hospital"],
  Kaduna: ["Barau Dikko Teaching Hospital", "Ahmadu Bello University Teaching Hospital"],
  Rivers: ["University of Port Harcourt Teaching Hospital"],
  Oyo: ["University College Hospital Ibadan"],
  Enugu: ["University of Nigeria Teaching Hospital"],
  Borno: ["University of Maiduguri Teaching Hospital"],
  Edo: ["University of Benin Teaching Hospital"],
  Imo: ["Federal Medical Centre Owerri"],
  Bauchi: ["Abubakar Tafawa Balewa University Teaching Hospital"],
  Benue: ["Federal Medical Centre Makurdi"],
  Anambra: ["Nnamdi Azikiwe University Teaching Hospital"],
};

function isLegacyCode(code) {
  return /^SO-\d+$/i.test(code || "");
}

function pad(n, size = 3) {
  return String(n).padStart(size, "0");
}

function profileOf(zoneName) {
  return SEQUENCE[zoneName] || SEQUENCE["South East"];
}

function applyProfile(asset, spec, index, state) {
  const [condition, verify, tagged, operational, hasCustodian, overdue] = spec;
  const [category, sub] = CATS[index % CATS.length];
  const custodian = hasCustodian ? `${state.description} Store Keeper` : "";
  const verified = verify === "Verified & Passed";
  return {
    name: asset.name || NAMES[index % NAMES.length],
    primaryCategory: category,
    category,
    subCategory: sub,
    facilitySite: state.description,
    state_id: state.id,
    state_name: state.description,
    zone_id: state.zonal_id,
    zone_name: state.zoneName,
    physicalCondition: condition,
    verificationStatus: verify,
    operationalStatus: operational,
    status: condition === "Retired" ? "RETIRED" : condition === "Obsolete" ? "OBSOLETE" : "ACTIVE",
    nhiaTagNumber: tagged ? `NHIA-${state.code}-${pad(index + 1, 2)}` : null,
    assignedCustodian: custodian,
    custodian,
    lastVerificationDate: `2026-${pad((index % 9) + 1, 2)}-15`,
    categoryAttributes: overdue ? { nextMaintenanceDate: "2026-03-20" } : { nextMaintenanceDate: "2026-12-15" },
    comments: verified ? "" : `${condition} asset at ${state.description}. Follow-up required.`,
    location: `${state.description} Store`,
    specificLocation: operational === "In Store" ? "Main store" : "Office floor",
  };
}

async function canonicalStates() {
  const zones = await ZonalOffice.findAll({ attributes: ["id", "description"] });
  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z.description]));
  const states = await StateOffice.findAll({ order: [["description", "ASC"], ["code", "ASC"]] });
  const byDescription = new Map();
  for (const state of states) {
    const key = state.description.trim().toLowerCase();
    const existing = byDescription.get(key);
    if (!existing || (isLegacyCode(existing.code) && !isLegacyCode(state.code))) {
      byDescription.set(key, state);
    }
  }
  return [...byDescription.values()].map((s) => ({
    id: s.id,
    code: s.code,
    description: s.description,
    zonal_id: s.zonal_id,
    zoneName: zoneById[s.zonal_id] || "Unassigned",
  }));
}

async function upsertAsset(where, values) {
  const existing = await StoreAsset.findOne({ where });
  if (existing) {
    await existing.update(values);
    return "updated";
  }
  await StoreAsset.create({ ...where, ...values });
  return "created";
}

async function seedAssets(states) {
  let updated = 0;
  let created = 0;
  const bySite = new Map();
  const assets = await StoreAsset.findAll();
  for (const asset of assets) {
    const key = String(asset.facilitySite || asset.state_name || "").trim().toLowerCase();
    if (!bySite.has(key)) bySite.set(key, []);
    bySite.get(key).push(asset);
  }

  for (const state of states) {
    const key = state.description.trim().toLowerCase();
    const rows = (bySite.get(key) || []).slice().sort((a, b) => String(a.assetNumber).localeCompare(String(b.assetNumber)));
    const extra = EXTRA_BY_STATE[state.description] || 0;
    const target = Math.max(rows.length, 6 + extra);
    const seq = profileOf(state.zoneName);

    for (let i = 0; i < target; i += 1) {
      const spec = seq[i % seq.length];
      const existing = rows[i];
      const assetNumber = existing?.assetNumber || `AST-VIS-${state.code}-${pad(i + 1, 2)}`;
      const values = applyProfile(existing || { name: NAMES[i % NAMES.length] }, spec, i, state);
      if (!existing) {
        values.assetNumber = assetNumber;
        values.assetId = assetNumber;
        values.description = `${values.name} at ${state.description} Store`;
        values.acquisitionDate = "2024-06-01";
        values.acquisitionCost = 120000 + (i * 15000);
        values.acquisitionValue = values.acquisitionCost;
        values.usefulLifeYears = 5;
        values.taggingMethod = values.nhiaTagNumber ? "QR Code" : null;
      }
      const result = await upsertAsset({ assetNumber }, values);
      if (result === "created") created += 1;
      else updated += 1;
    }
  }

  const hqSeq = SEQUENCE["North Central"];
  for (let i = 0; i < 8; i += 1) {
    const spec = hqSeq[i % hqSeq.length];
    const assetNumber = `AST-VIS-HQ-${pad(i + 1, 2)}`;
    const fakeState = { id: null, code: "HQ", description: "HQ", zonal_id: null, zoneName: "HQ" };
    const values = applyProfile({ name: NAMES[i % NAMES.length] }, spec, i, fakeState);
    values.facilitySite = "HQ";
    values.state_id = null;
    values.state_name = "HQ";
    values.zone_id = null;
    values.zone_name = "HQ";
    values.assetId = assetNumber;
    values.description = `${values.name} at NHIA Headquarters`;
    values.acquisitionDate = "2023-11-01";
    values.acquisitionCost = 250000 + i * 20000;
    values.acquisitionValue = values.acquisitionCost;
    const result = await upsertAsset({ assetNumber }, values);
    if (result === "created") created += 1;
    else updated += 1;
  }

  return { created, updated };
}

const PREPAYMENTS = [
  ["PP-VIS-2026-01", "2026-01-18", "A4 Copy Paper (ream)", "Office Consumables", 420, 400, 4500, "Lagos"],
  ["PP-VIS-2026-02", "2026-05-12", "A4 Copy Paper (ream)", "Office Consumables", 360, 340, 4700, "FCT (Abuja)"],
  ["PP-VIS-2026-03", "2026-08-20", "A4 Copy Paper (ream)", "Office Consumables", 280, 260, 4900, "Kano"],
  ["PP-VIS-2026-04", "2026-02-06", "Laser Toner Cartridge", "Office Consumables", 90, 80, 28500, "Rivers"],
  ["PP-VIS-2026-05", "2026-09-04", "Laser Toner Cartridge", "Office Consumables", 70, 64, 31000, "Kaduna"],
  ["PP-VIS-2026-06", "2026-04-22", "Generator diesel", "Power & Fuel", 700, 640, 980, "Lagos"],
  ["PP-VIS-2026-07", "2026-07-15", "Generator diesel", "Power & Fuel", 480, 420, 1020, "Borno"],
  ["PP-VIS-2026-08", "2026-03-11", "Dell OptiPlex Desktop", "Computer Equipment", 18, 16, 420000, "FCT (Abuja)"],
  ["PP-VIS-2026-09", "2026-06-19", "Lenovo Laptop", "Computer Equipment", 12, 10, 615000, "Lagos"],
  ["PP-VIS-2026-10", "2026-02-27", "Visitor chair", "Office Furniture", 200, 180, 45000, "Enugu"],
  ["PP-VIS-2026-11", "2026-08-08", "Executive office desk", "Office Furniture", 36, 32, 185000, "Oyo"],
  ["PP-VIS-2026-12", "2026-05-29", "Split air conditioner", "Office Equipment", 24, 20, 310000, "Rivers"],
  ["PP-VIS-2026-13", "2026-01-30", "Cleaning supplies kit", "Office Consumables", 220, 200, 6500, "Imo"],
  ["PP-VIS-2026-14", "2026-06-02", "Cleaning supplies kit", "Office Consumables", 180, 160, 6800, "Benue"],
  ["PP-VIS-2026-15", "2026-10-06", "Cleaning supplies kit", "Office Consumables", 120, 100, 7000, "Edo"],
  ["PP-VIS-2026-16", "2026-03-18", "Ballpoint pen (box)", "Office Consumables", 40, 24, 800, "Bauchi"],
  ["PP-VIS-2026-17", "2026-07-09", "Medical records folder", "Medical Records", 360, 320, 3500, "Kano"],
  ["PP-VIS-2026-18", "2026-09-16", "Network router", "Computer Equipment", 20, 18, 85000, "Anambra"],
];

async function seedPrepayments(states) {
  await PrepaymentAnalysis.ensurePrepaymentColumns();
  const byName = Object.fromEntries(states.map((s) => [s.description, s]));
  let n = 0;
  for (const [controlNumber, entryDate, item, category, ordered, supplied, rate, stateName] of PREPAYMENTS) {
    const state = byName[stateName];
    const values = {
      entryDate,
      procurementInstrument: "Local purchase order",
      contractorName: "NHIA Approved Supplier Ltd",
      contractorAddress: stateName,
      refInvoiceDeliveryNote: `DN-${controlNumber}`,
      itemDescription: item,
      category,
      unitOfMeasure: "Units",
      storeLocation: `${stateName} Store`,
      quantityOrdered: ordered,
      quantitySupplied: supplied,
      rate,
      remarks: "Dashboard sample supply",
      zone_id: state?.zonal_id ?? null,
      state_id: state?.id ?? null,
      zone_name: state?.zoneName ?? null,
      state_name: stateName,
    };
    const existing = await PrepaymentAnalysis.findOne({ where: { controlNumber } });
    if (existing) await existing.update(values);
    else await PrepaymentAnalysis.create({ controlNumber, ...values });
    n += 1;
  }
  return n;
}

function commentResponses(scores) {
  return COMMENT_QS.map((id, i) => ({ question_id: id, response: String(scores[i]), score: scores[i] }));
}

const CARD_PROFILES = [
  ["FCT (Abuja)", "National Hospital Abuja", [[5, 4, 4, 4, 5], [4, 4, 3, 4, 4], [5, 4, 4, 3, 5]]],
  ["Lagos", "Lagos University Teaching Hospital", [[4, 3, 3, 2, 3], [3, 2, 3, 2, 3], [5, 4, 4, 4, 4], [2, 2, 1, 2, 2]]],
  ["Kano", "Aminu Kano Teaching Hospital", [[3, 2, 2, 2, 3], [2, 2, 1, 2, 2], [4, 3, 3, 2, 3]]],
  ["Kaduna", "Barau Dikko Teaching Hospital", [[5, 4, 4, 4, 5], [4, 4, 4, 3, 4]]],
  ["Rivers", "University of Port Harcourt Teaching Hospital", [[3, 3, 2, 2, 3], [4, 3, 3, 3, 4], [2, 1, 2, 1, 2]]],
  ["Oyo", "University College Hospital Ibadan", [[4, 4, 3, 3, 4], [5, 4, 4, 4, 5]]],
  ["Enugu", "University of Nigeria Teaching Hospital", [[4, 3, 3, 3, 4], [3, 3, 2, 3, 3]]],
  ["Borno", "University of Maiduguri Teaching Hospital", [[2, 1, 2, 1, 2], [1, 1, 1, 2, 1], [3, 2, 2, 1, 2]]],
  ["Bauchi", "ATBUTH Bauchi", [[2, 2, 2, 1, 2], [3, 2, 2, 2, 3]]],
  ["Imo", "Federal Medical Centre Owerri", [[3, 3, 2, 2, 3], [4, 3, 3, 2, 4]]],
  ["Benue", "Federal Medical Centre Makurdi", [[3, 2, 2, 2, 2], [4, 3, 3, 3, 4]]],
  ["Edo", "University of Benin Teaching Hospital", [[4, 4, 3, 3, 4], [5, 4, 4, 3, 5]]],
];

const CARD_DATES = ["2026-01-20", "2026-04-14", "2026-07-09", "2026-09-18"];

async function seedCommentCards(states) {
  const byName = Object.fromEntries(states.map((s) => [s.description, s]));
  let n = 0;
  for (const [stateName, organisation, sets] of CARD_PROFILES) {
    const state = byName[stateName];
    if (!state) continue;
    for (let i = 0; i < sets.length; i += 1) {
      const scores = sets[i];
      const reference_id = `CCC-VIS-${state.code}-${pad(i + 1, 2)}`;
      const total = scores.reduce((s, v) => s + v, 0);
      const values = {
        zone_id: state.zonal_id,
        state_id: state.id,
        organisation,
        respondent_name: "Front desk respondent",
        card_date: CARD_DATES[i % CARD_DATES.length],
        responses: commentResponses(scores),
        total_score: total,
        average_score: Math.round((total / scores.length) * 100) / 100,
        created_by: "seed-dashboard-visual",
      };
      const existing = await ServicomCommentCard.findOne({ where: { reference_id } });
      if (existing) await existing.update(values);
      else await ServicomCommentCard.create({ reference_id, ...values });
      n += 1;
    }
  }
  return n;
}

function surveyResponses(pattern) {
  return SURVEY_QS.map((id, i) => ({
    question_id: id,
    response: pattern[i] === "Y" ? "Yes" : "No",
  }));
}

const SURVEY_TIERS = {
  strong: "NYYYYYNYYYYYYYYYY",
  mid: "NYYYNYNYYNYYYNYYN",
  weak: "NNYYNNNNNNYNYNYNY",
};

const SURVEYS = [
  ["FCT (Abuja)", "National Hospital Abuja", "2026-02-04", "strong"],
  ["FCT (Abuja)", "University of Abuja Teaching Hospital", "2026-05-19", "strong"],
  ["FCT (Abuja)", "National Hospital Abuja", "2026-08-11", "mid"],
  ["Lagos", "Lagos University Teaching Hospital", "2026-01-22", "mid"],
  ["Lagos", "General Hospital Ikeja", "2026-04-16", "strong"],
  ["Lagos", "Lagos State University Teaching Hospital", "2026-07-21", "mid"],
  ["Lagos", "Lagos University Teaching Hospital", "2026-09-08", "weak"],
  ["Kano", "Aminu Kano Teaching Hospital", "2026-02-18", "weak"],
  ["Kano", "Murtala Muhammed Specialist Hospital", "2026-06-03", "mid"],
  ["Kano", "Aminu Kano Teaching Hospital", "2026-09-02", "weak"],
  ["Kaduna", "Barau Dikko Teaching Hospital", "2026-03-09", "strong"],
  ["Kaduna", "Ahmadu Bello University Teaching Hospital", "2026-08-25", "mid"],
  ["Rivers", "University of Port Harcourt Teaching Hospital", "2026-01-28", "mid"],
  ["Rivers", "University of Port Harcourt Teaching Hospital", "2026-05-06", "weak"],
  ["Rivers", "University of Port Harcourt Teaching Hospital", "2026-08-14", "mid"],
  ["Oyo", "University College Hospital Ibadan", "2026-02-25", "strong"],
  ["Oyo", "University College Hospital Ibadan", "2026-07-30", "strong"],
  ["Enugu", "University of Nigeria Teaching Hospital", "2026-03-17", "mid"],
  ["Enugu", "University of Nigeria Teaching Hospital", "2026-09-10", "strong"],
  ["Borno", "University of Maiduguri Teaching Hospital", "2026-01-15", "weak"],
  ["Borno", "University of Maiduguri Teaching Hospital", "2026-04-22", "weak"],
  ["Borno", "University of Maiduguri Teaching Hospital", "2026-08-05", "weak"],
  ["Bauchi", "Abubakar Tafawa Balewa University Teaching Hospital", "2026-03-04", "weak"],
  ["Bauchi", "Abubakar Tafawa Balewa University Teaching Hospital", "2026-07-16", "mid"],
  ["Imo", "Federal Medical Centre Owerri", "2026-02-11", "mid"],
  ["Imo", "Federal Medical Centre Owerri", "2026-06-24", "weak"],
  ["Benue", "Federal Medical Centre Makurdi", "2026-05-13", "mid"],
  ["Benue", "Federal Medical Centre Makurdi", "2026-09-23", "strong"],
  ["Edo", "University of Benin Teaching Hospital", "2026-04-02", "strong"],
  ["Edo", "University of Benin Teaching Hospital", "2026-08-19", "mid"],
];

async function seedSurveys(states) {
  const byName = Object.fromEntries(states.map((s) => [s.description, s]));
  let n = 0;
  const seen = {};
  for (const [stateName, provider, survey_date, tier] of SURVEYS) {
    const state = byName[stateName];
    if (!state) continue;
    seen[state.code] = (seen[state.code] || 0) + 1;
    const reference_id = `SAT-VIS-${state.code}-${pad(seen[state.code], 2)}`;
    const pattern = SURVEY_TIERS[tier];
    const yes = [...pattern].filter((ch) => ch === "Y").length;
    const values = {
      zone_id: state.zonal_id,
      state_id: state.id,
      provider_name: provider,
      survey_date,
      survey_officers: "SERVICOM Team",
      responses: surveyResponses(pattern),
      total_score: yes,
      max_score: pattern.length,
      percentage_score: Math.round((yes / pattern.length) * 1000) / 10,
      created_by: "seed-dashboard-visual",
    };
    const existing = await ServicomSatisfactionSurvey.findOne({ where: { reference_id } });
    if (existing) await existing.update(values);
    else await ServicomSatisfactionSurvey.create({ reference_id, ...values });
    n += 1;
  }
  return n;
}

/**
 * Open rows have no close date. Closed rows carry resolution days and an SLA flag.
 * [state, month, type, domain, category, priority, route, status, complainant, facility, days, withinSla]
 */
const COMPLAINTS = [
  ["Lagos", 1, "HCF", "Financial", "Billing", "Top", "Email", "Under Investigation", "Funke Adeyemi", "Lagos University Teaching Hospital"],
  ["Lagos", 2, "HCF", "Financial", "Billing", "High", "Phone", "Closed", "Funke Adeyemi", "Lagos University Teaching Hospital", 16, false],
  ["Lagos", 3, "HCF", "Service Delivery", "Quality of Care", "High", "Walk-in", "Resolved", "Bola Johnson", "Lagos State University Teaching Hospital", 8, true],
  ["Lagos", 4, "HMO", "Operational", "Access", "Medium", "SERVICOM", "New/Acknowledged", "Tunde Bakare", "General Hospital Ikeja"],
  ["Lagos", 5, "Enrollee", "Relationship", "Communication", "Medium", "Letter", "Resolved", "Adaeze Nwosu", "Lagos University Teaching Hospital", 11, true],
  ["Lagos", 6, "HMO", "Financial", "Fraud", "Top", "Email", "Escalated", "Emeka Obi", "Lagos Island General Hospital"],
  ["Lagos", 7, "HCF", "Service Delivery", "Referral", "High", "Phone", "Awaiting Information from the Respondent", "Chioma Ade", "Lagos State University Teaching Hospital"],
  ["Lagos", 8, "HCF", "Operational", "Staffing & Resources", "Medium", "Walk-in", "Closed", "Kunle Martins", "General Hospital Ikeja", 26, false],
  ["Lagos", 2, "HCF", "Service Delivery", "Quality of Care", "High", "Email", "Under Investigation", "Ngozi Eze", "Lagos University Teaching Hospital"],
  ["Lagos", 9, "Enrollee", "Financial", "Billing", "Medium", "Email", "New/Acknowledged", "Segun Paul", "General Hospital Ikeja"],
  ["Lagos", 3, "HCF", "Relationship", "Abuse", "Top", "Walk-in", "Resolved", "Amina Yusuf", "General Hospital Ikeja", 4, true],
  ["Lagos", 10, "HMO", "Service Delivery", "Access", "High", "Phone", "Under Investigation", "Bola Johnson", "Lagos State University Teaching Hospital"],
  ["Kano", 1, "HCF", "Service Delivery", "Quality of Care", "Top", "Walk-in", "Escalated", "Musa Ibrahim", "Aminu Kano Teaching Hospital"],
  ["Kano", 4, "HCF", "Service Delivery", "Quality of Care", "High", "Email", "Closed", "Musa Ibrahim", "Aminu Kano Teaching Hospital", 22, false],
  ["Kano", 6, "HMO", "Financial", "Billing", "High", "Phone", "Under Investigation", "Fatima Sule", "Murtala Muhammed Specialist Hospital"],
  ["Kano", 8, "Enrollee", "Relationship", "Communication", "Medium", "Letter", "Resolved", "Aisha Bello", "Aminu Kano Teaching Hospital", 9, true],
  ["Kano", 3, "HCF", "Operational", "Staffing & Resources", "Medium", "SERVICOM", "New/Acknowledged", "Ibrahim Danladi", "Murtala Muhammed Specialist Hospital"],
  ["Kano", 9, "HCF", "Financial", "Fraud", "Top", "Email", "Awaiting Information from the Respondent", "Hauwa Yusuf", "Aminu Kano Teaching Hospital"],
  ["FCT (Abuja)", 2, "HCF", "Service Delivery", "Quality of Care", "High", "Email", "Resolved", "Mary Okon", "National Hospital Abuja", 6, true],
  ["FCT (Abuja)", 5, "HMO", "Financial", "Billing", "Top", "Phone", "Under Investigation", "Tunde Bakare", "University of Abuja Teaching Hospital"],
  ["FCT (Abuja)", 7, "Enrollee", "Relationship", "Communication", "Medium", "Walk-in", "Closed", "Fatima Bello", "National Hospital Abuja", 18, true],
  ["FCT (Abuja)", 8, "HCF", "Operational", "Access", "High", "SERVICOM", "Escalated", "NHIA Audit Desk", "Gwagwalada Specialist Hospital"],
  ["FCT (Abuja)", 10, "HCF", "Service Delivery", "Referral", "Medium", "Email", "New/Acknowledged", "Grace Ameh", "National Hospital Abuja"],
  ["Kaduna", 3, "HCF", "Financial", "Billing", "High", "Email", "Resolved", "Zainab Lawal", "Barau Dikko Teaching Hospital", 7, true],
  ["Kaduna", 6, "HMO", "Operational", "Access", "Top", "Phone", "Under Investigation", "Hauwa Suleiman", "Ahmadu Bello University Teaching Hospital"],
  ["Kaduna", 9, "Enrollee", "Service Delivery", "Quality of Care", "Medium", "Walk-in", "Closed", "Sani Garba", "Barau Dikko Teaching Hospital", 24, false],
  ["Rivers", 2, "HCF", "Financial", "Billing", "Top", "Email", "Escalated", "Ebiere Tamuno", "University of Port Harcourt Teaching Hospital"],
  ["Rivers", 5, "HCF", "Service Delivery", "Quality of Care", "High", "Walk-in", "Resolved", "Emeka Diri", "University of Port Harcourt Teaching Hospital", 12, false],
  ["Rivers", 7, "HMO", "Relationship", "Communication", "Medium", "Phone", "Under Investigation", "Tamuno Briggs", "University of Port Harcourt Teaching Hospital"],
  ["Rivers", 8, "Enrollee", "Operational", "Staffing & Resources", "Medium", "Letter", "Closed", "Ebiere Tamuno", "University of Port Harcourt Teaching Hospital", 15, true],
  ["Rivers", 4, "HCF", "Financial", "Fraud", "High", "SERVICOM", "Awaiting Information from the Respondent", "Sotonye Hart", "University of Port Harcourt Teaching Hospital"],
  ["Oyo", 1, "HCF", "Service Delivery", "Referral", "High", "Email", "Resolved", "Kemi Lawal", "University College Hospital Ibadan", 9, true],
  ["Oyo", 6, "Enrollee", "Financial", "Billing", "Medium", "Walk-in", "New/Acknowledged", "Tunde Adebayo", "University College Hospital Ibadan"],
  ["Oyo", 9, "HMO", "Relationship", "Communication", "Top", "Phone", "Under Investigation", "Bisi Ajayi", "University College Hospital Ibadan"],
  ["Enugu", 4, "HCF", "Service Delivery", "Quality of Care", "High", "Email", "Closed", "Chika Nwosu", "University of Nigeria Teaching Hospital", 13, false],
  ["Enugu", 8, "Enrollee", "Operational", "Access", "Medium", "Walk-in", "Resolved", "Ngozi Eze", "University of Nigeria Teaching Hospital", 10, true],
  ["Imo", 3, "HCF", "Financial", "Billing", "High", "Phone", "Under Investigation", "Chinedu Okafor", "Federal Medical Centre Owerri"],
  ["Imo", 7, "HCF", "Service Delivery", "Quality of Care", "Top", "Email", "Escalated", "Ngozi Eze", "Federal Medical Centre Owerri"],
  ["Imo", 5, "Enrollee", "Relationship", "Communication", "Medium", "Letter", "Resolved", "Ada Okoro", "Federal Medical Centre Owerri", 17, true],
  ["Bauchi", 2, "HCF", "Operational", "Staffing & Resources", "High", "Walk-in", "New/Acknowledged", "Sani Garba", "Abubakar Tafawa Balewa University Teaching Hospital"],
  ["Bauchi", 6, "HMO", "Financial", "Billing", "Top", "Email", "Under Investigation", "Hauwa Yusuf", "Federal Medical Centre Azare"],
  ["Bauchi", 9, "HCF", "Service Delivery", "Access", "Medium", "Phone", "Closed", "Ibrahim Danladi", "Specialist Hospital Bauchi", 21, false],
  ["Borno", 1, "HCF", "Service Delivery", "Quality of Care", "Top", "Walk-in", "Escalated", "Aisha Bukar", "University of Maiduguri Teaching Hospital"],
  ["Borno", 5, "Enrollee", "Financial", "Billing", "High", "Email", "Under Investigation", "Musa Ali", "University of Maiduguri Teaching Hospital"],
  ["Borno", 8, "HCF", "Relationship", "Communication", "Medium", "Phone", "Resolved", "Fatima Grema", "University of Maiduguri Teaching Hospital", 19, false],
  ["Benue", 4, "HCF", "Service Delivery", "Referral", "High", "SERVICOM", "Resolved", "Grace Ameh", "Federal Medical Centre Makurdi", 8, true],
  ["Benue", 7, "HMO", "Financial", "Fraud", "Top", "Email", "Under Investigation", "Chinedu Okafor", "Benue State University Teaching Hospital"],
  ["Edo", 3, "HCF", "Service Delivery", "Quality of Care", "High", "Walk-in", "Closed", "Osagie Osazee", "University of Benin Teaching Hospital", 10, true],
  ["Edo", 8, "Enrollee", "Operational", "Access", "Medium", "Phone", "New/Acknowledged", "Osaro Igbinovia", "University of Benin Teaching Hospital"],
  ["Anambra", 6, "HCF", "Financial", "Billing", "Medium", "Email", "Resolved", "Chioma Okeke", "Nnamdi Azikiwe University Teaching Hospital", 14, true],
  ["Anambra", 9, "HMO", "Relationship", "Communication", "High", "Letter", "Escalated", "Ifeanyi Eze", "Nnamdi Azikiwe University Teaching Hospital"],
];

function monthDate(month, day) {
  return `2026-${pad(month, 2)}-${pad(day, 2)}`;
}

async function seedComplaints(states) {
  const byName = Object.fromEntries(states.map((s) => [s.description, s]));
  const closed = new Set(["Resolved", "Closed", "Referred to Appropriate Authority", "Complaint Withdrawn"]);
  let n = 0;
  for (let i = 0; i < COMPLAINTS.length; i += 1) {
    const [stateName, month, type, domain, category, priority, route, status, complainant, facility, days, within] = COMPLAINTS[i];
    const state = byName[stateName];
    if (!state) continue;
    const complaint_number = `CMP-VIS-2026-${pad(i + 1)}`;
    const received = monthDate(month, 8 + (i % 12));
    const isClosed = closed.has(status);
    const values = {
      zone_id: state.zonal_id,
      state_id: state.id,
      reporting_year: 2026,
      reporting_month: month,
      entry_date: received,
      complaint_date: received,
      date_received: received,
      complaint_type: type,
      complaint_against: type === "Enrollee" ? "HCF" : type,
      complaint_category: category,
      category: category,
      complaint_domain: domain,
      priority_rating: priority,
      transmission_route: route,
      complainant_category: type === "Enrollee" ? "Enrollee" : type,
      complainant_name: complainant,
      respondent_category: type === "HMO" ? "HMO" : "Healthcare Facility",
      respondent_name: facility,
      facility_name: facility,
      status,
      officer_assigned: `${stateName} Enforcement Officer`,
      escalated: status === "Escalated",
      escalation_level: status === "Escalated" ? "Level 2" : null,
      description: `${category} complaint from ${complainant} about ${facility}.`,
      resolution_days: isClosed ? days : null,
      resolution_within_sla: isClosed ? Boolean(within) : null,
      date_closed: isClosed ? monthDate(Math.min(month + 1, 10), 20) : null,
      resolution_date: isClosed ? monthDate(Math.min(month + 1, 10), 20) : null,
      outcome: isClosed ? (within ? "Resolved" : "Closed beyond SLA") : null,
      created_by: "seed-dashboard-visual",
    };
    const existing = await ServicomComplaint.findOne({ where: { complaint_number } });
    if (existing) await existing.update(values);
    else await ServicomComplaint.create({ complaint_number, ...values });
    n += 1;
  }
  return n;
}

(async () => {
  try {
    await sequelize.authenticate();
    const states = await canonicalStates();
    if (!states.length) {
      console.error("No state offices found. Seed zones and states first.");
      process.exit(1);
    }
    const assets = await seedAssets(states);
    const prepay = await seedPrepayments(states);
    const cards = await seedCommentCards(states);
    const surveys = await seedSurveys(states);
    const complaints = await seedComplaints(states);
    console.log(`Assets: ${assets.created} created, ${assets.updated} updated`);
    console.log(`Prepayments: ${prepay}`);
    console.log(`Comment cards: ${cards}`);
    console.log(`Satisfaction surveys: ${surveys}`);
    console.log(`Complaints: ${complaints}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
