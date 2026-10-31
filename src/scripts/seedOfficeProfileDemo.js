/**
 * Seed realistic State & Zonal Office Profile demo data (Forms 1, 2, 3, 4).
 * Idempotent — can be safely re-run without duplicate key errors.
 *
 * Usage:
 *   node src/scripts/seedOfficeProfileDemo.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const {
  StateOffice,
  ZonalOffice,
  StateZonalOfficeProfile,
  OfficeAccommodation,
  UtilityServiceReport,
  StateZonalFocalPerson,
} = require("../models");

const DEMO_STATES = [
  {
    state_code: "KAN",
    zonal_code: "NW",
    coordinator: "Dr. Aminu Bello",
    phone: "08031234567",
    email: "aminu.bello@nhia.gov.ng",
    address: "Federal Secretariat Complex, Block B, Room 410, Katsina Road, Kano",
    office_email: "kano.state@nhia.gov.ng",
    staff_strength: 34,
    enrolment_target: 85000,
    annual_budget: 45000000.0,
    accommodation: {
      ownership_status: "Rented",
      rent_amount: 4500000.0,
      rent_expiry_date: "2026-12-31",
      current_condition: "Good",
      issue_description: "Minor dampness along east corridor after heavy rains.",
      remarks: "Annual lease paid and up-to-date; renewal due Q4 2026.",
    },
    utilities: [
      {
        reference_id: "UTL-KAN-2026-GEN-01",
        service_category: "generator",
        frequency: "biannual",
        cycle: 1,
        reporting_month: 6,
        contractor_name: "Mikano Power Systems Ltd",
        contractor_phone: "08023456789",
        contractor_email: "service.kano@mikano.com",
        invoice_number: "INV-MK-2026-4412",
        amount_claimed: 850000.0,
        amount_approved: 850000.0,
        service_description: "Biannual servicing of 100kVA Perkins generator: oil, filters, fan belt & battery check.",
        status: "approved",
      },
      {
        reference_id: "UTL-KAN-2026-SEC-01",
        service_category: "security",
        frequency: "monthly",
        reporting_month: 1,
        contractor_name: "Halogen Security Company Ltd",
        contractor_phone: "08033334455",
        contractor_email: "ops.kano@halogen.ng",
        invoice_number: "HS-KN-JAN-01",
        amount_claimed: 1200000.0,
        amount_approved: 1200000.0,
        service_description: "Guarding & access control for January 2026 (6 security guards on 24/7 shifts).",
        status: "submitted",
      },
      {
        reference_id: "UTL-KAN-2026-CLN-01",
        service_category: "cleaning",
        frequency: "monthly",
        reporting_month: 1,
        contractor_name: "CleanServe Environmental Services",
        contractor_phone: "08055556677",
        contractor_email: "admin@cleanserve.ng",
        invoice_number: "CS-KN-2026-001",
        amount_claimed: 650000.0,
        amount_approved: 650000.0,
        service_description: "Daily office janitorial, fumigation and compound gardening for January 2026.",
        status: "submitted",
      },
    ],
    focal_persons: [
      { domain: "ICT", name: "Ibrahim Dahiru", designation: "Chief Systems Officer", email: "ibrahim.dahiru@nhia.gov.ng", phone: "08030010001" },
      { domain: "SERVICOM", name: "Fatima Garba", designation: "Principal Confidential Secretary", email: "fatima.garba@nhia.gov.ng", phone: "08030010002" },
      { domain: "Quality Assurance", name: "Dr. Kabir Sani", designation: "Assistant Director SQA", email: "kabir.sani@nhia.gov.ng", phone: "08030010003" },
      { domain: "Enrolment", name: "Zainab Umar", designation: "Senior Programmes Officer", email: "zainab.umar@nhia.gov.ng", phone: "08030010004" },
      { domain: "Claims & Payments", name: "Mustapha Aliyu", designation: "Principal Officer", email: "mustapha.aliyu@nhia.gov.ng", phone: "08030010005" },
      { domain: "Enforcement & Compliance", name: "Bello Danjuma", designation: "Senior Officer", email: "bello.danjuma@nhia.gov.ng", phone: "08030010006" },
      { domain: "Legal Services", name: "Barr. Halima Yunusa", designation: "Senior Legal Officer", email: "halima.yunusa@nhia.gov.ng", phone: "08030010007" },
      { domain: "Finance & Accounts", name: "Usman Shehu", designation: "Chief Accountant", email: "usman.shehu@nhia.gov.ng", phone: "08030010008" },
    ],
  },
  {
    state_code: "BEN",
    zonal_code: "NC",
    coordinator: "Dr. Joy Terver",
    phone: "08039876543",
    email: "joy.terver@nhia.gov.ng",
    address: "Federal Secretariat, 3rd Floor, Wurukum, Makurdi, Benue State",
    office_email: "benue.state@nhia.gov.ng",
    staff_strength: 28,
    enrolment_target: 65000,
    annual_budget: 36000000.0,
    accommodation: {
      ownership_status: "Rented",
      rent_amount: 3600000.0,
      rent_expiry_date: "2026-10-31",
      current_condition: "Fair",
      issue_description: "Roof leak in registry archive room; ceiling board warped.",
      remarks: "Repair planned in Q2; landlord officially notified for structural maintenance.",
    },
    utilities: [
      {
        reference_id: "UTL-BEN-2026-GEN-01",
        service_category: "generator",
        frequency: "biannual",
        cycle: 1,
        reporting_month: 5,
        contractor_name: "Makurdi Electro-Mechanical Ltd",
        contractor_phone: "08034445566",
        contractor_email: "info@makurdielectro.com",
        invoice_number: "MEM-2026-092",
        amount_claimed: 720000.0,
        amount_approved: 720000.0,
        service_description: "First half routine maintenance of 60kVA generator.",
        status: "approved",
      },
      {
        reference_id: "UTL-BEN-2026-SEC-01",
        service_category: "security",
        frequency: "monthly",
        reporting_month: 1,
        contractor_name: "TivShield Security Services",
        contractor_phone: "08039998877",
        contractor_email: "tivshield@gmail.com",
        invoice_number: "TSS-BEN-26-01",
        amount_claimed: 950000.0,
        amount_approved: 950000.0,
        service_description: "Provision of 4 armed guards and perimeter watch for January 2026.",
        status: "submitted",
      },
    ],
    focal_persons: [
      { domain: "ICT", name: "David Aondoaver", designation: "Senior Systems Analyst", email: "david.aondoaver@nhia.gov.ng", phone: "08030020001" },
      { domain: "SERVICOM", name: "Grace Iorfa", designation: "Officer I", email: "grace.iorfa@nhia.gov.ng", phone: "08030020002" },
      { domain: "Quality Assurance", name: "Dr. Terngu Chia", designation: "Principal Medical Officer", email: "terngu.chia@nhia.gov.ng", phone: "08030020003" },
      { domain: "Enrolment", name: "Comfort Tyover", designation: "Senior Officer", email: "comfort.tyover@nhia.gov.ng", phone: "08030020004" },
    ],
  },
  {
    state_code: "LAG",
    zonal_code: "SW",
    coordinator: "Dr. Olusegun Adebayo",
    phone: "08021112233",
    email: "olusegun.adebayo@nhia.gov.ng",
    address: "Plot 12, Commercial Avenue, Yaba, Lagos",
    office_email: "lagos.state@nhia.gov.ng",
    staff_strength: 52,
    enrolment_target: 150000,
    annual_budget: 78000000.0,
    accommodation: {
      ownership_status: "NHIA-owned",
      rent_amount: null,
      rent_expiry_date: null,
      current_condition: "Good",
      issue_description: "Solar inverter system battery bank due for routine maintenance in August.",
      remarks: "NHIA freehold property. Routine structural upkeep managed directly.",
    },
    utilities: [
      {
        reference_id: "UTL-LAG-2026-GEN-01",
        service_category: "generator",
        frequency: "biannual",
        cycle: 1,
        reporting_month: 6,
        contractor_name: "JMG Power Systems Ltd",
        contractor_phone: "08031122334",
        contractor_email: "support@jmgpower.com",
        invoice_number: "JMG-LG-2026-118",
        amount_claimed: 1450000.0,
        amount_approved: 1450000.0,
        service_description: "Bi-annual heavy service of 250kVA generator and ATS transfer unit.",
        status: "approved",
      },
      {
        reference_id: "UTL-LAG-2026-SEC-01",
        service_category: "security",
        frequency: "monthly",
        reporting_month: 1,
        contractor_name: "KingsGuard Nigeria Ltd",
        contractor_phone: "08029988776",
        contractor_email: "ops@kingsguard.com",
        invoice_number: "KG-LG-2026-01",
        amount_claimed: 1800000.0,
        amount_approved: 1800000.0,
        service_description: "24-hour corporate security, baggage scanner, and access control for Yaba office.",
        status: "submitted",
      },
    ],
    focal_persons: [
      { domain: "ICT", name: "Adeola Folorunsho", designation: "Assistant Director ICT", email: "adeola.folorunsho@nhia.gov.ng", phone: "08030030001" },
      { domain: "SERVICOM", name: "Bisi Ogundele", designation: "Principal Officer", email: "bisi.ogundele@nhia.gov.ng", phone: "08030030002" },
      { domain: "Quality Assurance", name: "Dr. Kemi Balogun", designation: "Chief Medical Officer", email: "kemi.balogun@nhia.gov.ng", phone: "08030030003" },
      { domain: "Enrolment", name: "Femi Adeleke", designation: "Senior Officer", email: "femi.adeleke@nhia.gov.ng", phone: "08030030004" },
    ],
  },
  {
    state_code: "RIV",
    zonal_code: "SS",
    coordinator: "Dr. Chidubem Briggs",
    phone: "08034455667",
    email: "chidubem.briggs@nhia.gov.ng",
    address: "Federal Secretariat Complex, Aba Road, Port Harcourt, Rivers State",
    office_email: "rivers.state@nhia.gov.ng",
    staff_strength: 31,
    enrolment_target: 70000,
    annual_budget: 42000000.0,
    accommodation: {
      ownership_status: "Co-habiting",
      rent_amount: null,
      rent_expiry_date: null,
      current_condition: "Fair",
      issue_description: "Common central air-conditioning unit needs servicing.",
      remarks: "Co-located within Federal Secretariat building; maintenance shared via Federal Ministry of Works.",
    },
    utilities: [
      {
        reference_id: "UTL-RIV-2026-GEN-01",
        service_category: "generator",
        frequency: "biannual",
        cycle: 1,
        reporting_month: 6,
        contractor_name: "NigerDelta Power Solutions",
        contractor_phone: "08035556677",
        contractor_email: "support@ndpowersolutions.com",
        invoice_number: "NDP-PH-2026-004",
        amount_claimed: 890000.0,
        amount_approved: 890000.0,
        service_description: "Full service of 80kVA backup diesel generator.",
        status: "approved",
      },
    ],
    focal_persons: [
      { domain: "ICT", name: "Tamuno George", designation: "Senior IT Officer", email: "tamuno.george@nhia.gov.ng", phone: "08030040001" },
      { domain: "SERVICOM", name: "Blessing Amadi", designation: "Officer II", email: "blessing.amadi@nhia.gov.ng", phone: "08030040002" },
      { domain: "Quality Assurance", name: "Dr. Nkemdilim Okeke", designation: "Principal SQA Officer", email: "nkemdilim.okeke@nhia.gov.ng", phone: "08030040003" },
    ],
  },
  {
    state_code: "FCT",
    zonal_code: "NC",
    coordinator: "Dr. Abdullahi Musa",
    phone: "08027778899",
    email: "abdullahi.musa@nhia.gov.ng",
    address: "Federal Capital Territory State Office, Utako District, Abuja",
    office_email: "fct.state@nhia.gov.ng",
    staff_strength: 40,
    enrolment_target: 120000,
    annual_budget: 58000000.0,
    accommodation: {
      ownership_status: "Rented",
      rent_amount: 8500000.0,
      rent_expiry_date: "2027-03-31",
      current_condition: "Good",
      issue_description: "None. Recent interior renovation completed.",
      remarks: "Lease secured for two calendar years with option to renew.",
    },
    utilities: [
      {
        reference_id: "UTL-FCT-2026-GEN-01",
        service_category: "generator",
        frequency: "biannual",
        cycle: 1,
        reporting_month: 5,
        contractor_name: "Abuja Power Works Ltd",
        contractor_phone: "08031239999",
        contractor_email: "service@abujapower.ng",
        invoice_number: "APW-FCT-26-018",
        amount_claimed: 980000.0,
        amount_approved: 980000.0,
        service_description: "Routine scheduled service for 150kVA generator.",
        status: "approved",
      },
    ],
    focal_persons: [
      { domain: "ICT", name: "Suleiman Balarabe", designation: "Chief Systems Engineer", email: "suleiman.balarabe@nhia.gov.ng", phone: "08030050001" },
      { domain: "SERVICOM", name: "Aisha Bello", designation: "Principal Confidential Secretary", email: "aisha.bello@nhia.gov.ng", phone: "08030050002" },
      { domain: "Quality Assurance", name: "Dr. Uchechukwu Eze", designation: "Assistant Director SQA", email: "uchechukwu.eze@nhia.gov.ng", phone: "08030050003" },
      { domain: "Enrolment", name: "Hadiza Mohammed", designation: "Senior Officer", email: "hadiza.mohammed@nhia.gov.ng", phone: "08030050004" },
    ],
  },
];

async function seedOfficeProfiles() {
  console.log("🚀 Starting Office Profile demo seeds (Forms 1, 2, 3, 4)...");

  // Ensure all 4 Office Profile tables exist before querying
  try {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");
    await StateZonalOfficeProfile.sync();
    await OfficeAccommodation.sync();
    await UtilityServiceReport.sync();
    await StateZonalFocalPerson.sync();
  } finally {
    try {
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
    } catch (_) {}
  }

  for (const item of DEMO_STATES) {
    const state = await StateOffice.findOne({ where: { code: item.state_code } });
    if (!state) {
      console.warn(`⚠️ StateOffice ${item.state_code} not found; skipping.`);
      continue;
    }

    // 1. Form 1: General Profile (2026)
    const [profile2026, created2026] = await StateZonalOfficeProfile.findOrCreate({
      where: {
        state_code: item.state_code,
        reporting_year: 2026,
      },
      defaults: {
        zonal_code: item.zonal_code,
        state_id: state.id,
        coordinator_name: item.coordinator,
        coordinator_phone: item.phone,
        coordinator_email: item.email,
        office_address: item.address,
        office_email: item.office_email,
        staff_strength: item.staff_strength,
        enrolment_target: item.enrolment_target,
        annual_budget: item.annual_budget,
        status: "approved",
      },
    });

    if (!created2026) {
      await profile2026.update({
        coordinator_name: item.coordinator,
        coordinator_phone: item.phone,
        coordinator_email: item.email,
        office_address: item.address,
        office_email: item.office_email,
        staff_strength: item.staff_strength,
        enrolment_target: item.enrolment_target,
        annual_budget: item.annual_budget,
      });
    }

    // 1b. Historical profile (2025) for historical lookup
    await StateZonalOfficeProfile.findOrCreate({
      where: {
        state_code: item.state_code,
        reporting_year: 2025,
      },
      defaults: {
        zonal_code: item.zonal_code,
        state_id: state.id,
        coordinator_name: item.coordinator,
        coordinator_phone: item.phone,
        coordinator_email: item.email,
        office_address: item.address,
        office_email: item.office_email,
        staff_strength: Math.max(10, item.staff_strength - 4),
        enrolment_target: Math.round(item.enrolment_target * 0.85),
        annual_budget: Math.round(item.annual_budget * 0.88),
        status: "approved",
      },
    });

    // 2. Form 2: Office Accommodation
    const accomData = item.accommodation;
    if (accomData) {
      const [accom, accomCreated] = await OfficeAccommodation.findOrCreate({
        where: {
          state_code: item.state_code,
          reporting_year: 2026,
        },
        defaults: {
          profile_id: profile2026.id,
          zonal_code: item.zonal_code,
          state_id: state.id,
          ownership_status: accomData.ownership_status,
          rent_amount: accomData.rent_amount,
          rent_expiry_date: accomData.rent_expiry_date,
          current_condition: accomData.current_condition,
          issue_description: accomData.issue_description,
          remarks: accomData.remarks,
          status: "approved",
        },
      });

      if (!accomCreated) {
        await accom.update({
          ownership_status: accomData.ownership_status,
          rent_amount: accomData.rent_amount,
          rent_expiry_date: accomData.rent_expiry_date,
          current_condition: accomData.current_condition,
          issue_description: accomData.issue_description,
          remarks: accomData.remarks,
        });
      }
    }

    // 3. Form 3: Utility Services Reports
    if (item.utilities && item.utilities.length > 0) {
      for (const utl of item.utilities) {
        const [rep, repCreated] = await UtilityServiceReport.findOrCreate({
          where: { reference_id: utl.reference_id },
          defaults: {
            profile_id: profile2026.id,
            state_code: item.state_code,
            zonal_code: item.zonal_code,
            state_id: state.id,
            reporting_year: 2026,
            reporting_month: utl.reporting_month || 1,
            service_category: utl.service_category,
            frequency: utl.frequency,
            cycle: utl.cycle || null,
            contractor_name: utl.contractor_name,
            contractor_phone: utl.contractor_phone,
            contractor_email: utl.contractor_email,
            invoice_number: utl.invoice_number,
            amount_claimed: utl.amount_claimed,
            amount_approved: utl.amount_approved,
            service_description: utl.service_description,
            status: utl.status,
          },
        });

        if (!repCreated) {
          await rep.update({
            amount_claimed: utl.amount_claimed,
            amount_approved: utl.amount_approved,
            service_description: utl.service_description,
            status: utl.status,
          });
        }
      }
    }

    // 4. Form 4: Focal Persons Register
    if (item.focal_persons && item.focal_persons.length > 0) {
      for (const fp of item.focal_persons) {
        const [foc, focCreated] = await StateZonalFocalPerson.findOrCreate({
          where: {
            state_code: item.state_code,
            reporting_year: 2026,
            domain: fp.domain,
          },
          defaults: {
            zonal_code: item.zonal_code,
            state_id: state.id,
            officer_name: fp.name,
            designation: fp.designation,
            email: fp.email,
            phone: fp.phone,
          },
        });

        if (!focCreated) {
          await foc.update({
            officer_name: fp.name,
            designation: fp.designation,
            email: fp.email,
            phone: fp.phone,
          });
        }
      }
    }

    console.log(`✅ Seeded Office Profile for ${item.state_code} (${item.coordinator})`);
  }

  console.log("🎉 Office Profile demo seeding completed successfully!");
}

if (require.main === module) {
  seedOfficeProfiles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedOfficeProfiles };

