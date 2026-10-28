/**
 * Seed Enrolment Activity principals for Beneficiary Management pickers.
 * Creates 2 principal enrollees per state across all zones (idempotent).
 *
 *   node src/scripts/seedEnrolmentDemo.js
 *   npm run db:seed-enrolment-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const { EnrolmentReport, StateOffice } = require("../models");

const FIRST_NAMES = [
  "Adaobi", "Chinedu", "Yusuf", "Aisha", "Tunde", "Ngozi", "Ibrahim", "Fatima",
  "Grace", "Emeka", "Amina", "Bello", "Chioma", "Sani", "Halima", "Oluwaseun",
];
const SURNAMES = [
  "Okeke", "Bello", "Musa", "Adeyemi", "Okonkwo", "Lawal", "Danladi", "Eze",
  "Balogun", "Okafor", "Usman", "Nwosu", "Abdullahi", "Ibrahim", "Ojo", "Suleiman",
];
const HMOS = ["Hygeia HMO", "AIICO Multishield", "Avon HMO", "Leadway Health", "Reliance HMO"];
const HCFS = [
  "General Hospital", "Primary Health Centre", "Teaching Hospital",
  "Specialist Hospital", "Federal Medical Centre",
];
const BLOOD = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const MARITAL = ["Single", "Married", "Widowed"];
const PROGRAMS = [
  { code: "PRG-0001", name: "FSSHIP", type: "Fresh Enrolment" },
  { code: "PRG-0005", name: "GIFSHIP-G", type: "Fresh Enrolment" },
  { code: "PRG-0003", name: "OPS", type: "Fresh Enrolment" },
];

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function personFor(state, index) {
  const fi = (state.code.charCodeAt(0) + index * 3) % FIRST_NAMES.length;
  const si = (state.code.charCodeAt(1) + index * 5) % SURNAMES.length;
  const first = FIRST_NAMES[fi];
  const surname = SURNAMES[si];
  const ninBase = `${state.code.charCodeAt(0)}${state.code.charCodeAt(1)}${index + 1}`;
  const nin = `${ninBase}${String(100000000 + (fi * 97 + si * 13) % 900000000).slice(0, 9)}`.slice(0, 11);
  const hmo = HMOS[(fi + si) % HMOS.length];
  const hcf = `${state.description} ${HCFS[(fi + index) % HCFS.length]}`;
  return {
    surname,
    first_name: first,
    middle_name: index === 0 ? "A." : "B.",
    nin,
    nhia_number: `NHIA-${state.code}-${pad(index + 1, 4)}`,
    entity_type: "Principal",
    organization_mda: index === 0 ? `${state.description} State Civil Service` : "Private Sector / OPS",
    blood_group: BLOOD[(fi + si) % BLOOD.length],
    marital_status: MARITAL[index % MARITAL.length],
    state_of_origin: state.description,
    lga_of_origin: `${state.description} Central`,
    state_of_residence: state.description,
    lga_of_residence: `${state.description} Metro`,
    phone_number: `080${pad((fi * 100 + si * 10 + index) % 100000000, 8)}`,
    hmo,
    hcf,
    alternative_provider: `${state.description} ${HCFS[(si + 1) % HCFS.length]}`,
  };
}

async function main() {
  await sequelize.authenticate();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!EnrolmentReport) {
    throw new Error("EnrolmentReport not loaded — ensure APPROVED_FORMS.enrolment is set");
  }

  const states = await StateOffice.findAll({
    order: [["zonal_code", "ASC"], ["code", "ASC"]],
  });
  if (!states.length) {
    throw new Error("No state_offices — run zone/state seed first (npm run db:seed or seedZonesStates)");
  }

  // Replace only this seed's rows (safe for existing real data)
  const deleted = await EnrolmentReport.destroy({
    where: { reference_id: { [Op.like]: "ENR-DEMO-%" } },
  });
  if (deleted) console.log(`Cleared ${deleted} previous ENR-DEMO rows`);

  const year = 2026;
  const month = 10;
  const quarter = 4;
  let created = 0;

  for (const state of states) {
    for (let i = 0; i < 2; i++) {
      const prog = PROGRAMS[i % PROGRAMS.length];
      const person = personFor(state, i);
      const seq = created + 1;
      const reference_id = `ENR-DEMO-${pad(seq, 5)}`;

      await EnrolmentReport.create({
        reference_id,
        zonal_code: state.zonal_code,
        state_code: state.code,
        reporting_year: year,
        reporting_month: month,
        submission_date: `${year}-${pad(month)}-15`,
        submitted_by: "Demo Seed",
        status: "submitted",
        category: "enrolment",
        activity_code: "ENR-0001",
        activity_date: `${year}-${pad(month)}-${pad(5 + i)}`,
        enrolment_channel: "NHIA",
        enrolment_type: prog.type,
        program_code: prog.code,
        program_name: prog.name,
        enrolment_category: "Walk-in Registration",
        beneficiary_category: prog.name === "GIFSHIP-G" ? "Individual (GIFSHIP)" : "Principal (FSSHIP)",
        beneficiary_status: "Active",
        enrolment_count: 1,
        activity_status: "Completed",
        program_details: person,
        quarter,
      });
      created += 1;
    }
  }

  // One NIN + ID-card sample per zone (first state in zone) for activity tabs
  const zonesSeen = new Set();
  let extra = 0;
  for (const state of states) {
    if (zonesSeen.has(state.zonal_code)) continue;
    zonesSeen.add(state.zonal_code);
    extra += 1;
    await EnrolmentReport.create({
      reference_id: `ENR-DEMO-NIN-${state.zonal_code}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: year,
      reporting_month: month,
      submission_date: `${year}-${pad(month)}-20`,
      submitted_by: "Demo Seed",
      status: "submitted",
      category: "nin_validation",
      activity_code: "ENR-0002",
      activity_date: `${year}-${pad(month)}-18`,
      enrolment_channel: "NHIA",
      enrollees_validated: 12,
      activity_status: "Validated",
      program_details: {
        enrollee_name: `${SURNAMES[extra % SURNAMES.length]} ${FIRST_NAMES[extra % FIRST_NAMES.length]}`,
        nin_number: `9${pad(extra, 10)}`,
        validation_status: "Validated",
      },
      quarter,
    });
    extra += 1;
    await EnrolmentReport.create({
      reference_id: `ENR-DEMO-IDC-${state.zonal_code}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: year,
      reporting_month: month,
      submission_date: `${year}-${pad(month)}-22`,
      submitted_by: "Demo Seed",
      status: "submitted",
      category: "id_card_issuance",
      activity_code: "ENR-0003",
      activity_date: `${year}-${pad(month)}-20`,
      enrolment_channel: "NHIA",
      enrolment_count: 8,
      activity_status: "Issued",
      program_details: {
        enrollee_name: `${SURNAMES[(extra + 2) % SURNAMES.length]} ${FIRST_NAMES[(extra + 1) % FIRST_NAMES.length]}`,
        nhia_number: `NHIA-${state.code}-IDC`,
        request_category: "Issuance (New enrolees)",
        id_card_status: "Issued",
        issue_date: `${year}-${pad(month)}-21`,
      },
      quarter,
    });
  }

  const byZone = await EnrolmentReport.findAll({
    attributes: [
      "zonal_code",
      [sequelize.fn("COUNT", sequelize.col("reference_id")), "n"],
    ],
    where: {
      reference_id: { [Op.like]: "ENR-DEMO-%" },
      category: "enrolment",
    },
    group: ["zonal_code"],
    raw: true,
  });

  console.log(`\nSeeded ${created} principal enrolment rows across ${states.length} states`);
  console.log("Principals per zone:");
  byZone.forEach((r) => console.log(`  ${r.zonal_code}: ${r.n}`));
  console.log("\nBeneficiary Management → Additional / Extra Dependant can now pick principals in every zone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
