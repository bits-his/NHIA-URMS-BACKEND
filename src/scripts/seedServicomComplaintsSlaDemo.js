/**
 * Seed 20 Servicom complaints with varied priorities and SLA states.
 * Idempotent — upserts by complaint_number (CMP-2026-00009 … CMP-2026-00028).
 *
 * Reference date for SLA colours: 2026-08-12 (adjust date_received if testing later).
 */
const ServicomComplaint = require("../models/ServicomComplaint");

const DEMO_COMPLAINTS = [
  {
    complaint_number: "CMP-2026-00009", zone_id: 3, state_id: 14, reporting_year: 2026,
    complaint_date: "2026-08-12", complaint_type: "HCF", complaint_category: "Billing", category_code: "HCF-BILL-001",
    complaint_domain: "Financial", domain_code: "FIN", offence_reference: "HCF-5.5.2", priority_rating: "Top",
    date_received: "2026-08-12", transmission_route: "Email", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", escalated: false,
    description: "Receipt and management of any enrollee as a fee-paying patient.",
    sla_note: "Top — White (received today)",
  },
  {
    complaint_number: "CMP-2026-00010", zone_id: 3, state_id: 14, reporting_year: 2026,
    complaint_date: "2026-08-11", complaint_type: "HCF", complaint_category: "Billing", category_code: "HCF-BILL-001",
    complaint_domain: "Financial", domain_code: "FIN", offence_reference: "HCF-5.5.3", priority_rating: "Top",
    date_received: "2026-08-11", transmission_route: "Phone", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    officer_assigned: "Mrs. Ada Okafor", investigation_start_date: "2026-08-12", status: "Under Investigation",
    actions_taken: "Complaint acknowledged", actions_details: "Investigation commenced on schedule.", escalated: false,
    description: "Solicitation or charging any fee from enrollee beyond NHIA co-payment.",
    sla_note: "Top — White (investigation on track)",
  },
  {
    complaint_number: "CMP-2026-00011", zone_id: 4, state_id: 22, reporting_year: 2026,
    complaint_date: "2026-08-10", complaint_type: "HMO", complaint_category: "Billing",
    complaint_domain: "Financial", domain_code: "FIN", priority_rating: "Top",
    date_received: "2026-08-10", transmission_route: "Walk-in", complainant_category: "Enrollee", respondent_category: "HMO",
    status: "New/Acknowledged", escalated: false,
    description: "HMO delayed capitation payment to accredited facility for two months.",
    sla_note: "Top — Yellow (not acknowledged)",
  },
  {
    complaint_number: "CMP-2026-00012", zone_id: 1, state_id: 3, reporting_year: 2026,
    complaint_date: "2026-08-10", complaint_type: "Enrollee", complaint_category: "Access",
    complaint_domain: "Service Delivery", domain_code: "SVC", priority_rating: "Top",
    date_received: "2026-08-10", transmission_route: "Hotline", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", actions_taken: "Complaint acknowledged", actions_details: "Awaiting officer assignment.", escalated: false,
    description: "Enrollee denied emergency care despite valid NHIA card.",
    sla_note: "Top — Amber (investigation not commenced)",
  },
  {
    complaint_number: "CMP-2026-00013", zone_id: 3, state_id: 20, reporting_year: 2026,
    complaint_date: "2026-08-10", complaint_type: "HCF", complaint_category: "Fraud", category_code: "HCF-FRD-001",
    complaint_domain: "Financial", domain_code: "FIN", offence_reference: "HCF-5.5.4", priority_rating: "Top",
    date_received: "2026-08-10", transmission_route: "Email", complainant_category: "NHIA Staff", respondent_category: "Healthcare Facility",
    officer_assigned: "Mr. Ibrahim Musa", investigation_start_date: "2026-08-11", status: "Under Investigation",
    actions_taken: "Complaint acknowledged", actions_details: "Site visit scheduled; records requested from facility.", escalated: false,
    description: "Making false claims to HMOs for treatment not carried out.",
    sla_note: "Top — Yellow (investigation in progress)",
  },
  {
    complaint_number: "CMP-2026-00014", zone_id: 2, state_id: 9, reporting_year: 2026,
    complaint_date: "2026-08-06", complaint_type: "HCF", complaint_category: "Administrative", category_code: "HCF-ADM-001",
    complaint_domain: "Operational", domain_code: "OPS", offence_reference: "HCF-5.5.7", priority_rating: "Top",
    date_received: "2026-08-06", transmission_route: "Letter", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    officer_assigned: "Dr. Helen Uche", investigation_start_date: "2026-08-07", status: "Under Investigation",
    actions_taken: "Complaint acknowledged", actions_details: "Investigation stalled pending facility response.", escalated: false,
    description: "Failure to keep and maintain standard medical records for enrollees.",
    sla_note: "Top — Red (escalation overdue)",
  },
  {
    complaint_number: "CMP-2026-00015", zone_id: 5, state_id: 31, reporting_year: 2026,
    complaint_date: "2026-08-04", complaint_type: "HCF", complaint_category: "Service Delivery", category_code: "HCF-SVC-001",
    complaint_domain: "Service Delivery", domain_code: "SVC", offence_reference: "HCF-5.5.31", priority_rating: "Top",
    date_received: "2026-08-04", transmission_route: "Phone", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    officer_assigned: "Mrs. Grace Etim", investigation_start_date: "2026-08-05", status: "Awaiting Respondent Action",
    actions_taken: "Complaint acknowledged", actions_details: "Facility requested extension; respondent has not replied.", escalated: false,
    description: "Delay in accessing care beyond Standard Treatment Protocol waiting time.",
    sla_note: "Top — Red + resolution overdue",
  },
  {
    complaint_number: "CMP-2026-00016", zone_id: 3, state_id: 14, reporting_year: 2026,
    complaint_date: "2026-08-07", complaint_type: "HCF", complaint_category: "Billing", category_code: "HCF-BILL-001",
    complaint_domain: "Financial", domain_code: "FIN", offence_reference: "HCF-5.5.2", priority_rating: "Top",
    date_received: "2026-08-07", transmission_route: "Email", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    officer_assigned: "Mr. James Ngwo", investigation_start_date: "2026-08-08", status: "Closed",
    actions_taken: "Complaint acknowledged", actions_details: "Fee reversed; enrollee refunded.", escalated: false,
    resolution_days: 4, resolution_within_sla: true, date_closed: "2026-08-11", outcome: "Resolved",
    remarks: "Closed within SLA — demo seed.",
    description: "Receipt and management of any enrollee as a fee-paying patient.",
    sla_note: "Top — White (closed within SLA)",
  },
  {
    complaint_number: "CMP-2026-00017", zone_id: 4, state_id: 22, reporting_year: 2026,
    complaint_date: "2026-08-12", complaint_type: "Enrollee", complaint_category: "Communication",
    complaint_domain: "Relationship", domain_code: "REL", priority_rating: "High",
    date_received: "2026-08-12", transmission_route: "Email", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", escalated: false,
    description: "Poor communication from provider desk on NHIA benefit package.",
    sla_note: "High — White (received today)",
  },
  {
    complaint_number: "CMP-2026-00018", zone_id: 1, state_id: 2, reporting_year: 2026,
    complaint_date: "2026-08-11", complaint_type: "HMO", complaint_category: "Operational",
    complaint_domain: "Operational", domain_code: "OPS", priority_rating: "High",
    date_received: "2026-08-11", transmission_route: "Portal", complainant_category: "HMO", respondent_category: "NHIA",
    officer_assigned: "Mr. Yusuf Abdullahi", investigation_start_date: "2026-08-12", status: "Under Investigation",
    actions_taken: "Complaint acknowledged", actions_details: "Reviewing HMO remittance records.", escalated: false,
    description: "HMO portal access issues blocking claims submission for 48 hours.",
    sla_note: "High — White (investigation on track)",
  },
  {
    complaint_number: "CMP-2026-00019", zone_id: 3, state_id: 20, reporting_year: 2026,
    complaint_date: "2026-08-10", complaint_type: "HCF", complaint_category: "Quality of Care", category_code: "HCF-QOC-001",
    complaint_domain: "Service Delivery", domain_code: "SVC", offence_reference: "HCF-5.5.28", priority_rating: "High",
    date_received: "2026-08-10", transmission_route: "Walk-in", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", escalated: false,
    description: "Deliberate under-management of enrollee contrary to clinical guidelines.",
    sla_note: "High — Yellow (not acknowledged)",
  },
  {
    complaint_number: "CMP-2026-00020", zone_id: 2, state_id: 9, reporting_year: 2026,
    complaint_date: "2026-08-07", complaint_type: "Enrollee", complaint_category: "Referral",
    complaint_domain: "Access", domain_code: "ACC", priority_rating: "High",
    date_received: "2026-08-07", transmission_route: "Hotline", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", actions_taken: "Complaint acknowledged", actions_details: "Officer on leave; reassignment pending.", escalated: false,
    description: "Facility refused referral to specialist despite NHIA coverage.",
    sla_note: "High — Amber (investigation not commenced)",
  },
  {
    complaint_number: "CMP-2026-00021", zone_id: 5, state_id: 31, reporting_year: 2026,
    complaint_date: "2026-07-31", complaint_type: "HCF", complaint_category: "Fraud", category_code: "HCF-FRD-001",
    complaint_domain: "Financial", domain_code: "FIN", offence_reference: "HCF-5.5.5", priority_rating: "High",
    date_received: "2026-07-31", transmission_route: "Letter", complainant_category: "NHIA Staff", respondent_category: "Healthcare Facility",
    officer_assigned: "Dr. Amina Lawal", investigation_start_date: "2026-08-04", status: "Under Investigation",
    actions_taken: "Complaint acknowledged", actions_details: "Evidence collection ongoing; escalation threshold passed.", escalated: false,
    description: "Engaging in fraudulent activity against the Authority.",
    sla_note: "High — Red (escalation overdue)",
  },
  {
    complaint_number: "CMP-2026-00022", zone_id: 4, state_id: 22, reporting_year: 2026,
    complaint_date: "2026-08-05", complaint_type: "HMO", complaint_category: "Billing",
    complaint_domain: "Financial", domain_code: "FIN", priority_rating: "High",
    date_received: "2026-08-05", transmission_route: "Email", complainant_category: "Healthcare Facility", respondent_category: "HMO",
    officer_assigned: "Mrs. Grace Etim", investigation_start_date: "2026-08-06", status: "Escalated",
    actions_taken: "Complaint acknowledged", actions_details: "Escalated to zonal director for intervention.",
    escalated: true, escalation_level: "Level 2", escalation_date: "2026-08-11", escalated_to: "Zonal Director",
    description: "Capitation underpayment affecting drug stock availability.",
    sla_note: "High — Escalated (workflow test)",
  },
  {
    complaint_number: "CMP-2026-00023", zone_id: 3, state_id: 14, reporting_year: 2026,
    complaint_date: "2026-08-12", complaint_type: "Enrollee", complaint_category: "Staffing & Resources",
    complaint_domain: "Operational", domain_code: "OPS", priority_rating: "Medium",
    date_received: "2026-08-12", transmission_route: "Phone", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", escalated: false,
    description: "Insufficient NHIA desk staff during peak hours.",
    sla_note: "Medium — White (received today)",
  },
  {
    complaint_number: "CMP-2026-00024", zone_id: 1, state_id: 3, reporting_year: 2026,
    complaint_date: "2026-08-11", complaint_type: "HCF", complaint_category: "Communication", category_code: "HCF-COM-001",
    complaint_domain: "Relationship", domain_code: "REL", offence_reference: "HCF-5.5.24", priority_rating: "Medium",
    date_received: "2026-08-11", transmission_route: "Email", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", escalated: false,
    description: "Poor provider-stakeholder communication on NHIA policy changes.",
    sla_note: "Medium — White (within acknowledge window)",
  },
  {
    complaint_number: "CMP-2026-00025", zone_id: 2, state_id: 9, reporting_year: 2026,
    complaint_date: "2026-08-07", complaint_type: "Enrollee", complaint_category: "Access",
    complaint_domain: "Access", domain_code: "ACC", priority_rating: "Medium",
    date_received: "2026-08-07", transmission_route: "Walk-in", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    status: "New/Acknowledged", escalated: false,
    description: "Long queue at NHIA verification desk exceeding 2 hours.",
    sla_note: "Medium — Yellow (not acknowledged)",
  },
  {
    complaint_number: "CMP-2026-00026", zone_id: 4, state_id: 22, reporting_year: 2026,
    complaint_date: "2026-08-06", complaint_type: "HMO", complaint_category: "Administrative",
    complaint_domain: "Operational", domain_code: "OPS", priority_rating: "Medium",
    date_received: "2026-08-06", transmission_route: "Portal", complainant_category: "HMO", respondent_category: "NHIA",
    status: "New/Acknowledged", actions_taken: "Complaint acknowledged", actions_details: "Pending assignment to state desk.", escalated: false,
    description: "HMO failed to submit monthly NHIA returns on time.",
    sla_note: "Medium — Amber (investigation not commenced)",
  },
  {
    complaint_number: "CMP-2026-00027", zone_id: 3, state_id: 20, reporting_year: 2026,
    complaint_date: "2026-07-20", complaint_type: "HCF", complaint_category: "Administrative", category_code: "HCF-ADM-002",
    complaint_domain: "Operational", domain_code: "OPS", offence_reference: "HCF-5.5.12", priority_rating: "Medium",
    date_received: "2026-07-20", transmission_route: "Letter", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    officer_assigned: "Mr. Ibrahim Musa", investigation_start_date: "2026-07-25", status: "Under Investigation",
    actions_taken: "Complaint acknowledged", actions_details: "Prolonged investigation; escalation deadline exceeded.", escalated: false,
    description: "Failure to submit claims within the stipulated period.",
    sla_note: "Medium — Red + resolution overdue",
  },
  {
    complaint_number: "CMP-2026-00028", zone_id: 5, state_id: 31, reporting_year: 2026,
    complaint_date: "2026-08-01", complaint_type: "Enrollee", complaint_category: "Abuse",
    complaint_domain: "Relationship", domain_code: "REL", priority_rating: "Medium",
    date_received: "2026-08-01", transmission_route: "Hotline", complainant_category: "Enrollee", respondent_category: "Healthcare Facility",
    officer_assigned: "Mrs. Grace Etim", investigation_start_date: "2026-08-04", status: "Closed",
    actions_taken: "Complaint acknowledged", actions_details: "Counselling provided; matter resolved amicably.", escalated: false,
    resolution_days: 7, resolution_within_sla: true, date_closed: "2026-08-08", outcome: "Resolved",
    remarks: "Closed within Medium SLA — demo seed.",
    description: "Staff used inappropriate language toward enrollee at registration.",
    sla_note: "Medium — White (closed within SLA)",
  },
];

async function seedServicomComplaintsSlaDemo() {
  await ServicomComplaint.sync();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of DEMO_COMPLAINTS) {
    const { sla_note, ...payload } = row;
    const defaults = { ...payload, created_by: "SLA Demo Seed" };

    try {
      const [record, isNew] = await ServicomComplaint.findOrCreate({
        where: { complaint_number: payload.complaint_number },
        defaults,
      });

      if (isNew) {
        created += 1;
        console.log(`  ✅  ${payload.complaint_number} — ${sla_note}`);
      } else {
        await record.update(defaults);
        updated += 1;
        console.log(`  ↻  ${payload.complaint_number} — ${sla_note}`);
      }
    } catch (err) {
      skipped += 1;
      console.warn(`  ⚠  ${payload.complaint_number} skipped: ${err.message}`);
    }
  }

  console.log(`\n✅  Servicom SLA demo complaints: ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}`);
  return { created, updated, skipped };
}

module.exports = { seedServicomComplaintsSlaDemo, DEMO_COMPLAINTS };
