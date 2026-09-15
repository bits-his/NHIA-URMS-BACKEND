/**
 * Enrich SERVICOM complaints for Director Enforcement dashboard demos:
 * facility names, complaint_against, and coverage across all 6 zones.
 *
 *   node src/scripts/seedEnforcementComplaintsDemo.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const ServicomComplaint = require("../models/ServicomComplaint");

/** Existing SLA demo rows — fill facility + against party where missing. */
const FACILITY_PATCHES = {
  "CMP-2026-00009": { facility_name: "Benue State University Teaching Hospital", complaint_against: "HCF", complainant_name: "Aisha Bello", respondent_name: "BSUTH Makurdi" },
  "CMP-2026-00010": { facility_name: "Federal Medical Centre Makurdi", complaint_against: "HCF", complainant_name: "Chinedu Okafor", respondent_name: "FMC Makurdi" },
  "CMP-2026-00011": { facility_name: "Lagos University Teaching Hospital", complaint_against: "HMO", complainant_name: "Funke Adeyemi", respondent_name: "HealthCare HMO Ltd" },
  "CMP-2026-00012": { facility_name: "Aminu Kano Teaching Hospital", complaint_against: "HCF", complainant_name: "Musa Ibrahim", respondent_name: "AKTH" },
  "CMP-2026-00013": { facility_name: "National Hospital Abuja", complaint_against: "HCF", complainant_name: "NHIA Audit Desk", respondent_name: "National Hospital" },
  "CMP-2026-00014": { facility_name: "Federal Medical Centre Azare", complaint_against: "HCF", complainant_name: "Hauwa Yusuf", respondent_name: "FMC Azare" },
  "CMP-2026-00015": { facility_name: "Federal Medical Centre Owerri", complaint_against: "HCF", complainant_name: "Ngozi Eze", respondent_name: "FMC Owerri" },
  "CMP-2026-00016": { facility_name: "University of Abuja Teaching Hospital", complaint_against: "HCF", complainant_name: "Tunde Bakare", respondent_name: "UATH" },
  "CMP-2026-00017": { facility_name: "Lagos Island General Hospital", complaint_against: "HCF", complainant_name: "Bola Johnson", respondent_name: "LIGH" },
  "CMP-2026-00018": { facility_name: "Ahmadu Bello University Teaching Hospital", complaint_against: "HMO", complainant_name: "Total Health Trust", respondent_name: "NHIA Portal Desk" },
  "CMP-2026-00019": { facility_name: "University of Ilorin Teaching Hospital", complaint_against: "HCF", complainant_name: "Kemi Lawal", respondent_name: "UITH" },
  "CMP-2026-00020": { facility_name: "Abubakar Tafawa Balewa University Teaching Hospital", complaint_against: "HCF", complainant_name: "Sani Garba", respondent_name: "ATBUTH" },
  "CMP-2026-00021": { facility_name: "Federal Teaching Hospital Abakaliki", complaint_against: "HCF", complainant_name: "NHIA SE Desk", respondent_name: "FETHA" },
  "CMP-2026-00022": { facility_name: "Lagos State University Teaching Hospital", complaint_against: "HMO", complainant_name: "LASUTH Claims Unit", respondent_name: "Hygeia HMO" },
  "CMP-2026-00023": { facility_name: "Federal Medical Centre Makurdi", complaint_against: "HCF", complainant_name: "Grace Ameh", respondent_name: "FMC Makurdi" },
  "CMP-2026-00024": { facility_name: "Murtala Muhammed Specialist Hospital", complaint_against: "HCF", complainant_name: "Fatima Sule", respondent_name: "MMSH Kano" },
  "CMP-2026-00025": { facility_name: "Specialist Hospital Bauchi", complaint_against: "HCF", complainant_name: "Ibrahim Danladi", respondent_name: "SH Bauchi" },
  "CMP-2026-00026": { facility_name: "Lagos University Teaching Hospital", complaint_against: "HMO", complainant_name: "Reliance HMO", respondent_name: "NHIA SW Desk" },
  "CMP-2026-00027": { facility_name: "Gwagwalada Specialist Hospital", complaint_against: "HCF", complainant_name: "Mary Okon", respondent_name: "Gwagwalada Specialist" },
  "CMP-2026-00028": { facility_name: "Imo State University Teaching Hospital", complaint_against: "HCF", complainant_name: "Chika Nwosu", respondent_name: "IMSUTH" },
};

/** Extra rows so South South (zone 6) and facility filters have data. */
const EXTRA = [
  {
    complaint_number: "CMP-2026-00030",
    zone_id: 6, state_id: 37, reporting_year: 2026, reporting_month: 8,
    entry_date: "2026-08-10", complaint_date: "2026-08-09",
    complaint_type: "HCF", complaint_against: "HCF", complaint_category: "Billing",
    category_code: "HCF-BILL-001", complaint_domain: "Financial", domain_code: "FIN",
    offence_reference: "HCF-5.5.2", priority_rating: "Top",
    date_received: "2026-08-10", transmission_route: "Email",
    complainant_category: "Enrollee", complainant_name: "Ebiere Tamuno",
    respondent_category: "Healthcare Facility", respondent_name: "UPTH",
    facility_name: "University of Port Harcourt Teaching Hospital",
    status: "Under Investigation", officer_assigned: "Mrs. Grace Etim",
    investigation_start_date: "2026-08-11", escalated: false,
    actions_taken: "Complaint acknowledged",
    actions_details: "Billing ledger requested from UPTH NHIA desk.",
    description: "Enrollee billed as private patient despite valid NHIA authorisation.",
  },
  {
    complaint_number: "CMP-2026-00031",
    zone_id: 6, state_id: 32, reporting_year: 2026, reporting_month: 8,
    entry_date: "2026-08-08", complaint_date: "2026-08-07",
    complaint_type: "HMO", complaint_against: "HMO", complaint_category: "Access",
    complaint_domain: "Access", domain_code: "ACC", priority_rating: "High",
    date_received: "2026-08-08", transmission_route: "Hotline",
    complainant_category: "Enrollee", complainant_name: "Okoro Essien",
    respondent_category: "HMO", respondent_name: "Clearline HMO",
    facility_name: "University of Uyo Teaching Hospital",
    status: "Escalated", escalated: true, escalation_level: "Level 2",
    escalation_date: "2026-08-12", escalated_to: "Zonal Director",
    officer_assigned: "Mr. James Ngwo", investigation_start_date: "2026-08-09",
    actions_taken: "Complaint acknowledged",
    actions_details: "HMO failed to authorise emergency admission within SLA.",
    description: "Delayed HMO authorisation for emergency CEmONC case.",
  },
  {
    complaint_number: "CMP-2026-00032",
    zone_id: 6, state_id: 36, reporting_year: 2026, reporting_month: 7,
    entry_date: "2026-07-28", complaint_date: "2026-07-25",
    complaint_type: "HCF", complaint_against: "HCF", complaint_category: "Quality of Care",
    category_code: "HCF-QOC-001", complaint_domain: "Service Delivery", domain_code: "SVC",
    offence_reference: "HCF-5.5.28", priority_rating: "High",
    date_received: "2026-07-28", transmission_route: "Walk-in",
    complainant_category: "Enrollee", complainant_name: "Osagie Osazee",
    respondent_category: "Healthcare Facility", respondent_name: "UBTH",
    facility_name: "University of Benin Teaching Hospital",
    status: "Closed", escalated: false,
    officer_assigned: "Dr. Helen Uche", investigation_start_date: "2026-07-29",
    resolution_days: 10, resolution_within_sla: true, date_closed: "2026-08-07",
    outcome: "Resolved", remarks: "Clinical review completed; corrective action plan accepted.",
    description: "Alleged under-management of chronic care enrollee.",
  },
  {
    complaint_number: "CMP-2026-00033",
    zone_id: 1, state_id: 2, reporting_year: 2026, reporting_month: 8,
    entry_date: "2026-08-12", complaint_date: "2026-08-11",
    complaint_type: "HCF", complaint_against: "HCF", complaint_category: "Service Delivery",
    category_code: "HCF-SVC-001", complaint_domain: "Service Delivery", domain_code: "SVC",
    priority_rating: "Medium", date_received: "2026-08-12", transmission_route: "Portal",
    complainant_category: "Enrollee", complainant_name: "Zainab Lawal",
    respondent_category: "Healthcare Facility", respondent_name: "Barau Dikko TH",
    facility_name: "Barau Dikko Teaching Hospital",
    status: "New/Acknowledged", escalated: false,
    description: "Long waiting time beyond STP for outpatient NHIA clinic.",
  },
  {
    complaint_number: "CMP-2026-00034",
    zone_id: 4, state_id: 26, reporting_year: 2026, reporting_month: 8,
    entry_date: "2026-08-05", complaint_date: "2026-08-04",
    complaint_type: "Enrollee", complaint_against: "HCF", complaint_category: "Communication",
    complaint_domain: "Relationship", domain_code: "REL", priority_rating: "Medium",
    date_received: "2026-08-05", transmission_route: "Phone",
    complainant_category: "Enrollee", complainant_name: "Adeola Ojo",
    respondent_category: "Healthcare Facility", respondent_name: "UCH Ibadan",
    facility_name: "University College Hospital Ibadan",
    status: "Under Investigation", officer_assigned: "Mrs. Ada Okafor",
    investigation_start_date: "2026-08-06", escalated: false,
    actions_taken: "Complaint acknowledged",
    description: "Poor counselling on NHIA benefit package at registration desk.",
  },
];

async function upsert(row) {
  const [record, isNew] = await ServicomComplaint.findOrCreate({
    where: { complaint_number: row.complaint_number },
    defaults: { ...row, created_by: "Enforcement Demo Seed" },
  });
  if (!isNew) await record.update({ ...row, created_by: "Enforcement Demo Seed" });
  return isNew;
}

(async () => {
  try {
    await sequelize.authenticate();
    await ServicomComplaint.sync({ alter: true });

    let patched = 0;
    for (const [num, patch] of Object.entries(FACILITY_PATCHES)) {
      const row = await ServicomComplaint.findOne({ where: { complaint_number: num } });
      if (!row) continue;
      await row.update(patch);
      patched += 1;
      console.log(`  ↻  ${num} — facility/against updated`);
    }

    let created = 0;
    let updated = 0;
    for (const row of EXTRA) {
      const isNew = await upsert(row);
      if (isNew) {
        created += 1;
        console.log(`  ✅  ${row.complaint_number} — ${row.facility_name}`);
      } else {
        updated += 1;
        console.log(`  ↻  ${row.complaint_number} — refreshed`);
      }
    }

    const [hmos] = await sequelize.query("SELECT id, name FROM hmo_providers ORDER BY id LIMIT 12");
    let hmoLinked = 0;
    if (hmos.length) {
      const hmoNums = ["CMP-2026-00011", "CMP-2026-00018", "CMP-2026-00022", "CMP-2026-00026", "CMP-2026-00031"];
      for (let i = 0; i < hmoNums.length; i += 1) {
        const hmo = hmos[i % hmos.length];
        const [n] = await sequelize.query(
          "UPDATE servicom_complaints SET respondent_hmo_id = ?, respondent_name = COALESCE(NULLIF(respondent_name, ''), ?) WHERE complaint_number = ?",
          { replacements: [hmo.id, hmo.name, hmoNums[i]] },
        );
        if (n?.affectedRows) hmoLinked += 1;
      }
    }

    const [[stats]] = await sequelize.query(`
      SELECT COUNT(*) AS total,
        SUM(zone_id IS NOT NULL) AS with_zone,
        SUM(facility_name IS NOT NULL AND facility_name <> '') AS with_facility,
        SUM(respondent_hmo_id IS NOT NULL OR complainant_hmo_id IS NOT NULL) AS with_hmo
      FROM servicom_complaints
    `);
    console.log(`\n✅  Patched ${patched} existing · ${created} created · ${updated} updated · ${hmoLinked} HMO-linked`);
    console.log(`   Totals: ${stats.total} complaints · ${stats.with_zone} with zone · ${stats.with_facility} with facility · ${stats.with_hmo} with HMO`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
