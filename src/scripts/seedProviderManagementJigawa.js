/**
 * Seed Provider Management activities for Jigawa (North West).
 * Replaces only rows whose reference_id matches PACC|PREC|PQA|PMED-JIG-*.
 *
 *   node src/scripts/seedProviderManagementJigawa.js
 *   npm run db:seed-provider-jigawa
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ProviderManagementReport, StateOffice } = require("../models");

const YEAR = 2026;
const MONTHS = 10;
const ZONE = "NW";
const STATE = "JIG";
const TOTAL_FACILITIES = 512;
const SUBMITTED_BY = "Jigawa State Office";

const LGAS = [
  "Dutse",
  "Hadejia",
  "Gumel",
  "Kazaure",
  "Ringim",
  "Birnin Kudu",
  "Jahun",
  "Kafin Hausa",
];

const FORMS = {
  accreditation: { prefix: "PACC", code: "PM-0001", category: "Accreditation" },
  reaccreditation: { prefix: "PREC", code: "PM-0002", category: "Re-accreditation" },
  "qa-inspections": { prefix: "PQA", code: "PM-0003", category: "Quality Assurance" },
  "medical-audits": { prefix: "PMED", code: "PM-0004", category: "Medical Audit" },
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function quarterFromMonth(month) {
  return Math.ceil(month / 3);
}

function vary(base, month, salt, spread = 6) {
  return base + ((month * 3 + salt * 5) % (spread + 1)) - Math.floor(spread / 2);
}

function clampCovered(planned, covered) {
  return Math.max(0, Math.min(planned, covered));
}

function reportStatus(month) {
  if (month <= 7) return "approved";
  if (month === 8) return "endorsed";
  if (month === 9) return "submitted";
  return "awaiting_review";
}

function activityStatus(month, form, programme) {
  if (month < 10) {
    if (month === 3 && form === "qa-inspections") return "Deferred";
    return "Completed";
  }
  if (form === "accreditation") return "In Progress";
  if (form === "reaccreditation" && programme === "BHCPF") return "In Progress";
  if (form === "medical-audits") return "Deferred";
  return "Completed";
}

function fundingFor(month, form) {
  if (form === "medical-audits" && month % 2 === 0) {
    return { funding_option: "Special/Ad-hoc Funded", activity_budget: 850000 + month * 25000, approved_amount: 720000 + month * 20000 };
  }
  if (form === "reaccreditation" && month % 3 === 0) {
    return { funding_option: "Funded (Budgetary)", activity_budget: 1200000 + month * 40000, approved_amount: 980000 + month * 30000 };
  }
  return { funding_option: "Routine", activity_budget: null, approved_amount: null };
}

function buildRows() {
  const rows = [];
  for (let month = 1; month <= MONTHS; month++) {
    const lga = LGAS[(month - 1) % LGAS.length];
    const date = `${YEAR}-${pad(month)}-15`;
    const common = {
      zonal_code: ZONE,
      state_code: STATE,
      reporting_year: YEAR,
      reporting_month: month,
      quarter: quarterFromMonth(month),
      submission_date: `${YEAR}-${pad(month)}-22`,
      submitted_by: SUBMITTED_BY,
      status: reportStatus(month),
      activity_date: date,
      total_facilities_in_state: TOTAL_FACILITIES,
    };

    const accPlanned = vary(22, month, 1, 8);
    const accCovered = clampCovered(accPlanned, vary(16, month, 2, 6));
    rows.push({
      ...common,
      reference_id: `PACC-JIG-${YEAR}-${pad(month)}-F`,
      form_type: "accreditation",
      engagement_code: FORMS.accreditation.code,
      engagement_category: FORMS.accreditation.category,
      related_programme: "FSSHIP",
      facilities_planned: accPlanned,
      facilities_covered: accCovered,
      ...fundingFor(month, "accreditation"),
      activity_status: activityStatus(month, "accreditation", "FSSHIP"),
      applications_received: vary(36, month, 1, 10),
      forms_sold: vary(30, month, 2, 8),
      completed_forms_returned: vary(24, month, 3, 8),
      awaiting_accreditation: vary(58, month, 4, 16),
      remarks: `FSSHIP accreditation visits in ${lga} and neighbouring LGAs.`,
      supporting_evidence_types: "Accreditation Letter|Signed Checklist",
    });

    const phcPlanned = vary(14, month, 3, 6);
    const phcCovered = clampCovered(phcPlanned, vary(10, month, 4, 4));
    rows.push({
      ...common,
      reference_id: `PACC-JIG-${YEAR}-${pad(month)}-B`,
      form_type: "accreditation",
      engagement_code: FORMS.accreditation.code,
      engagement_category: FORMS.accreditation.category,
      related_programme: "BHCPF",
      bhcpf_activity_type: "Accreditation",
      facilities_planned: phcPlanned,
      facilities_covered: phcCovered,
      ...fundingFor(month, "accreditation"),
      activity_status: activityStatus(month, "accreditation", "BHCPF"),
      phcs_awaiting_accreditation: vary(72, month, 2, 18),
      remarks: `BHCPF PHC accreditation in ${lga} LGA.`,
      supporting_evidence_types: "Inspection Report|Photographs",
    });

    const rePlanned = vary(12, month, 2, 6);
    const reCovered = clampCovered(rePlanned, vary(9, month, 1, 4));
    rows.push({
      ...common,
      reference_id: `PREC-JIG-${YEAR}-${pad(month)}-F`,
      form_type: "reaccreditation",
      engagement_code: FORMS.reaccreditation.code,
      engagement_category: FORMS.reaccreditation.category,
      related_programme: "FSSHIP",
      facilities_planned: rePlanned,
      facilities_covered: reCovered,
      ...fundingFor(month, "reaccreditation"),
      activity_status: activityStatus(month, "reaccreditation", "FSSHIP"),
      awaiting_reaccreditation: vary(34, month, 3, 12),
      remarks: `FSSHIP re-accreditation of secondary facilities around ${lga}.`,
      supporting_evidence_types: "Facility Register|Accreditation Letter",
    });

    const rePhcPlanned = vary(10, month, 5, 4);
    const rePhcCovered = clampCovered(rePhcPlanned, vary(7, month, 2, 4));
    rows.push({
      ...common,
      reference_id: `PREC-JIG-${YEAR}-${pad(month)}-B`,
      form_type: "reaccreditation",
      engagement_code: FORMS.reaccreditation.code,
      engagement_category: FORMS.reaccreditation.category,
      related_programme: "BHCPF",
      bhcpf_activity_type: "Reaccreditation",
      facilities_planned: rePhcPlanned,
      facilities_covered: rePhcCovered,
      ...fundingFor(month, "reaccreditation"),
      activity_status: activityStatus(month, "reaccreditation", "BHCPF"),
      phcs_awaiting_reaccreditation: vary(41, month, 1, 14),
      remarks: `BHCPF PHC re-accreditation cycle in ${lga}.`,
      supporting_evidence_types: "Signed Checklist|Photographs",
    });

    const qaProgramme = month % 4 === 0 ? "Other" : "FSSHIP";
    const qaPlanned = vary(9, month, 1, 4);
    const qaStatus = activityStatus(month, "qa-inspections", qaProgramme);
    rows.push({
      ...common,
      reference_id: `PQA-JIG-${YEAR}-${pad(month)}-${qaProgramme === "Other" ? "O" : "F"}`,
      form_type: "qa-inspections",
      engagement_code: FORMS["qa-inspections"].code,
      engagement_category: FORMS["qa-inspections"].category,
      related_programme: qaProgramme,
      facilities_planned: qaPlanned,
      facilities_covered: qaStatus === "Deferred" ? 0 : clampCovered(qaPlanned, vary(7, month, 3, 4)),
      ...fundingFor(month, "qa-inspections"),
      activity_status: qaStatus,
      remarks: qaStatus === "Deferred"
        ? `QA inspection in ${lga} deferred.`
        : `Quality assurance inspection of facilities in ${lga}.`,
      supporting_evidence_types: "Inspection Report|Signed Checklist",
    });

    const medProgramme = month % 2 === 0 ? "Other" : "FSSHIP";
    const medPlanned = vary(5, month, 2, 3);
    const medStatus = activityStatus(month, "medical-audits", medProgramme);
    rows.push({
      ...common,
      reference_id: `PMED-JIG-${YEAR}-${pad(month)}-${medProgramme === "Other" ? "O" : "F"}`,
      form_type: "medical-audits",
      engagement_code: FORMS["medical-audits"].code,
      engagement_category: FORMS["medical-audits"].category,
      related_programme: medProgramme,
      facilities_planned: medPlanned,
      facilities_covered: medStatus === "Deferred" ? 0 : clampCovered(medPlanned, vary(4, month, 1, 2)),
      ...fundingFor(month, "medical-audits"),
      activity_status: medStatus,
      remarks: medStatus === "Deferred"
        ? `Medical audit for ${lga} deferred to the next cycle.`
        : `Medical audit of selected facilities in ${lga}.`,
      supporting_evidence_types: "Audit Report|Attendance Register",
    });
  }
  return rows;
}

async function main() {
  await sequelize.authenticate();
  if (!ProviderManagementReport) {
    throw new Error("ProviderManagementReport is not loaded");
  }

  const state = await StateOffice.findOne({ where: { code: STATE, zonal_code: ZONE } });
  if (!state) {
    throw new Error(`State ${STATE} in zone ${ZONE} was not found. Seed zones and states first.`);
  }

  const rows = buildRows();
  const refs = rows.map((r) => r.reference_id);

  await ProviderManagementReport.destroy({
    where: { reference_id: { [Op.in]: refs } },
  });

  await ProviderManagementReport.bulkCreate(rows);

  const count = await ProviderManagementReport.count({
    where: { state_code: STATE, zonal_code: ZONE, reporting_year: YEAR },
  });
  console.log(`Seeded ${rows.length} provider management activities for ${state.description} (${ZONE}).`);
  console.log(`${count} ${YEAR} rows now on file for ${STATE}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
