/**
 * Adds principal enrollee records (with an enrolment type) used by Beneficiary Management.
 * Does not remove existing enrolment activity reports.
 */
require("dotenv").config();
const sequelize = require("../config/database");
const EnrolmentReport = require("../models/EnrolmentReport");
const EnrolmentReportLine = require("../models/EnrolmentReportLine");

const PEOPLE = [
  {
    ref: "ENR-PRIN-001",
    zone_id: 4,
    state_id: 2,
    month: 10,
    program_code: "PRG-0001",
    program_name: "FSSHIP",
    enrolment_type: "Fresh Enrolment",
    beneficiary_category: "Principal (FSSHIP)",
    person: {
      surname: "Okonkwo",
      first_name: "Chinedu",
      middle_name: "Emeka",
      nin: "12345678901",
      nhia_number: "NHIA-OY-10442",
      entity_type: "Principal",
      blood_group: "O+",
      marital_status: "Married",
      state_of_origin: "Anambra",
      lga_of_origin: "Idemili North",
      state_of_residence: "Oyo",
      lga_of_residence: "Ibadan North",
      hmo: "Hygeia HMO",
      hcf: "UCH Ibadan",
      phone_number: "08031234567",
    },
  },
  {
    ref: "ENR-PRIN-002",
    zone_id: 4,
    state_id: 2,
    month: 9,
    program_code: "PRG-0001",
    program_name: "FSSHIP",
    enrolment_type: "Fresh Enrolment",
    beneficiary_category: "Principal (FSSHIP)",
    person: {
      surname: "Balogun",
      first_name: "Adewale",
      middle_name: "Tunde",
      nin: "22345678901",
      nhia_number: "NHIA-OY-11890",
      entity_type: "Principal",
      blood_group: "A+",
      marital_status: "Married",
      state_of_origin: "Oyo",
      lga_of_origin: "Ogbomosho North",
      state_of_residence: "Oyo",
      lga_of_residence: "Akinyele",
      hmo: "AIICO Multishield",
      hcf: "Adeoyo Hospital",
      phone_number: "08049876543",
    },
  },
  {
    ref: "ENR-PRIN-003",
    zone_id: 4,
    state_id: 60,
    month: 9,
    program_code: "PRG-0001",
    program_name: "FSSHIP",
    enrolment_type: "Fresh Enrolment",
    beneficiary_category: "Principal (FSSHIP)",
    person: {
      surname: "Lawal",
      first_name: "Fatima",
      middle_name: "Amina",
      nin: "32345678901",
      nhia_number: "NHIA-LG-22018",
      entity_type: "Principal",
      blood_group: "B+",
      marital_status: "Married",
      state_of_origin: "Kano",
      lga_of_origin: "Nassarawa",
      state_of_residence: "Lagos",
      lga_of_residence: "Ikeja",
      hmo: "AIICO Multishield",
      hcf: "Lagos Island General",
      phone_number: "08061112233",
    },
  },
  {
    ref: "ENR-PRIN-004",
    zone_id: 1,
    state_id: 8,
    month: 8,
    program_code: "PRG-0001",
    program_name: "FSSHIP",
    enrolment_type: "Fresh Enrolment",
    beneficiary_category: "Principal (FSSHIP)",
    person: {
      surname: "Musa",
      first_name: "Ibrahim",
      middle_name: "Sani",
      nin: "42345678901",
      nhia_number: "NHIA-KD-33091",
      entity_type: "Principal",
      blood_group: "O-",
      marital_status: "Single",
      state_of_origin: "Kaduna",
      lga_of_origin: "Zaria",
      state_of_residence: "Kaduna",
      lga_of_residence: "Kaduna North",
      hmo: "Avon HMO",
      hcf: "Barau Dikko Teaching Hospital",
      phone_number: "08072223344",
    },
  },
  {
    ref: "ENR-PRIN-005",
    zone_id: 1,
    state_id: 14,
    month: 7,
    program_code: "PRG-0005",
    program_name: "GIFSHIP-G",
    enrolment_type: "Renewal",
    beneficiary_category: "Individual (GIFSHIP)",
    person: {
      surname: "Danjuma",
      first_name: "Aisha",
      middle_name: "Binta",
      nin: "52345678901",
      nhia_number: "NHIA-KN-11820",
      entity_type: "Principal",
      blood_group: "AB+",
      marital_status: "Married",
      state_of_origin: "Kano",
      lga_of_origin: "Gwale",
      state_of_residence: "Kano",
      lga_of_residence: "Kano Municipal",
      hmo: "Hygeia HMO",
      hcf: "Murtala Mohammed Specialist Hospital",
      phone_number: "08083334455",
    },
  },
  {
    ref: "ENR-PRIN-006",
    zone_id: 3,
    state_id: 58,
    month: 6,
    program_code: "PRG-0003",
    program_name: "OPS",
    enrolment_type: "Fresh Enrolment",
    beneficiary_category: "Principal (FSSHIP)",
    person: {
      surname: "Okeke",
      first_name: "Grace",
      middle_name: "Ngozi",
      nin: "62345678901",
      nhia_number: "NHIA-FC-44102",
      entity_type: "Principal",
      blood_group: "A-",
      marital_status: "Single",
      state_of_origin: "Enugu",
      lga_of_origin: "Nsukka",
      state_of_residence: "FCT",
      lga_of_residence: "Abuja Municipal",
      hmo: "Leadway Health",
      hcf: "National Hospital Abuja",
      phone_number: "08094445566",
    },
  },
];

(async () => {
  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    const existing = await EnrolmentReport.findAll({
      where: { reference_id: PEOPLE.map((p) => p.ref) },
      transaction: t,
    });
    const ids = existing.map((row) => row.id);
    if (ids.length) {
      await EnrolmentReportLine.destroy({ where: { report_id: ids }, transaction: t });
      await EnrolmentReport.destroy({ where: { id: ids }, transaction: t });
    }
    for (const person of PEOPLE) {
      const report = await EnrolmentReport.create({
        reference_id: person.ref,
        zone_id: person.zone_id,
        state_id: person.state_id,
        reporting_year: 2026,
        reporting_month: person.month,
        submission_date: "2026-06-01",
        submitted_by: "Enrolment Officer",
        status: "approved",
      }, { transaction: t });
      await EnrolmentReportLine.create({
        report_id: report.id,
        category: "enrolment",
        activity_code: "ENR-0001",
        activity_date: "2026-06-01",
        enrolment_channel: "NHIA",
        enrolment_type: person.enrolment_type,
        program_code: person.program_code,
        program_name: person.program_name,
        enrolment_category: "Individual",
        beneficiary_category: person.beneficiary_category,
        beneficiary_status: "Active",
        enrolment_count: 1,
        activity_status: "Completed",
        program_details: person.person,
        quarter: Math.ceil(person.month / 3),
      }, { transaction: t });
    }
    await t.commit();
    console.log(`Seeded ${PEOPLE.length} principal enrollees`);
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error(err);
    process.exit(1);
  }
})();
