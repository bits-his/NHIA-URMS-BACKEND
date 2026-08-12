-- =============================================================================
-- SERVICOM COMPLAINTS — SLA DEMO SEED (20 rows)
-- Database: nhia_db
-- Reference "today" for SLA calculation: 2026-08-12 (Wednesday)
--
-- SLA rules (complaint_sla_rules table):
--   Top    — ack 1d | investigate 1d | escalate 3d | resolve 5d
--   High   — ack 1d | investigate 2d | escalate 7d | resolve 10d
--   Medium — ack 2d | investigate 3d | escalate 14d | resolve 20d
--
-- Run via Node (recommended):  npm run db:seed-complaint-sla
-- Or phpMyAdmin / mysql CLI if you prefer this file directly.
-- =============================================================================

USE nhia_db;

-- Remove previous demo rows (safe to re-run)
DELETE FROM servicom_complaints
WHERE complaint_number IN (
  'CMP-2026-00009','CMP-2026-00010','CMP-2026-00011','CMP-2026-00012','CMP-2026-00013',
  'CMP-2026-00014','CMP-2026-00015','CMP-2026-00016','CMP-2026-00017','CMP-2026-00018',
  'CMP-2026-00019','CMP-2026-00020','CMP-2026-00021','CMP-2026-00022','CMP-2026-00023',
  'CMP-2026-00024','CMP-2026-00025','CMP-2026-00026','CMP-2026-00027','CMP-2026-00028'
);

INSERT INTO servicom_complaints (
  complaint_number, zone_id, state_id, reporting_year,
  complaint_date, complaint_type, complaint_category, category_code,
  complaint_domain, domain_code, offence_reference, priority_rating,
  date_received, transmission_route,
  complainant_category, respondent_category,
  officer_assigned, investigation_start_date,
  status, actions_taken, actions_details,
  escalated, escalation_level, escalation_date, escalated_to,
  resolution_days, resolution_within_sla,
  date_closed, outcome, remarks, description,
  created_by, created_at, updated_at
) VALUES

-- ── TOP PRIORITY (7 rows) ───────────────────────────────────────────────────

-- #1  WHITE — received today, on track
('CMP-2026-00009', 3, 14, 2026,
 '2026-08-12', 'HCF', 'Billing', 'HCF-BILL-001', 'Financial', 'FIN', 'HCF-5.5.2', 'Top',
 '2026-08-12', 'Email', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Receipt and management of any enrollee as a fee-paying patient.',
 'SLA Demo Seed', NOW(), NOW()),

-- #2  WHITE — acknowledged + investigation started on time (1 working day)
('CMP-2026-00010', 3, 14, 2026,
 '2026-08-11', 'HCF', 'Billing', 'HCF-BILL-001', 'Financial', 'FIN', 'HCF-5.5.3', 'Top',
 '2026-08-11', 'Phone', 'Enrollee', 'Healthcare Facility',
 'Mrs. Ada Okafor', '2026-08-12', 'Under Investigation', 'Complaint acknowledged',
 'Investigation commenced on schedule.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Solicitation or charging any fee from enrollee beyond NHIA co-payment.',
 'SLA Demo Seed', NOW(), NOW()),

-- #3  YELLOW — not acknowledged within SLA (2 working days elapsed)
('CMP-2026-00011', 4, 22, 2026,
 '2026-08-10', 'HMO', 'Billing', NULL, 'Financial', 'FIN', NULL, 'Top',
 '2026-08-10', 'Walk-in', 'Enrollee', 'HMO',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'HMO delayed capitation payment to accredited facility for two months.',
 'SLA Demo Seed', NOW(), NOW()),

-- #4  AMBER — acknowledged but investigation not commenced (2 working days)
('CMP-2026-00012', 1, 3, 2026,
 '2026-08-10', 'Enrollee', 'Access', NULL, 'Service Delivery', 'SVC', NULL, 'Top',
 '2026-08-10', 'Hotline', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', 'Complaint acknowledged', 'Awaiting officer assignment.',
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Enrollee denied emergency care despite valid NHIA card.',
 'SLA Demo Seed', NOW(), NOW()),

-- #5  YELLOW — investigation in progress (2 working days, no overdue flag)
('CMP-2026-00013', 3, 20, 2026,
 '2026-08-10', 'HCF', 'Fraud', 'HCF-FRD-001', 'Financial', 'FIN', 'HCF-5.5.4', 'Top',
 '2026-08-10', 'Email', 'NHIA Staff', 'Healthcare Facility',
 'Mr. Ibrahim Musa', '2026-08-11', 'Under Investigation', 'Complaint acknowledged',
 'Site visit scheduled; records requested from facility.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Making false claims to HMOs for treatment not carried out.',
 'SLA Demo Seed', NOW(), NOW()),

-- #6  RED — escalation overdue (4 working days, not escalated)
('CMP-2026-00014', 2, 9, 2026,
 '2026-08-06', 'HCF', 'Administrative', 'HCF-ADM-001', 'Operational', 'OPS', 'HCF-5.5.7', 'Top',
 '2026-08-06', 'Letter', 'Enrollee', 'Healthcare Facility',
 'Dr. Helen Uche', '2026-08-07', 'Under Investigation', 'Complaint acknowledged',
 'Investigation stalled pending facility response.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Failure to keep and maintain standard medical records for enrollees.',
 'SLA Demo Seed', NOW(), NOW()),

-- #7  RED + resolution overdue flag (6 working days, still open)
('CMP-2026-00015', 5, 31, 2026,
 '2026-08-04', 'HCF', 'Service Delivery', 'HCF-SVC-001', 'Service Delivery', 'SVC', 'HCF-5.5.31', 'Top',
 '2026-08-04', 'Phone', 'Enrollee', 'Healthcare Facility',
 'Mrs. Grace Etim', '2026-08-05', 'Awaiting Respondent Action', 'Complaint acknowledged',
 'Facility requested extension; respondent has not replied.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Delay in accessing care beyond Standard Treatment Protocol waiting time.',
 'SLA Demo Seed', NOW(), NOW()),

-- #8  WHITE — closed within Top SLA (resolved in 4 calendar days, target 5 working days)
('CMP-2026-00016', 3, 14, 2026,
 '2026-08-07', 'HCF', 'Billing', 'HCF-BILL-001', 'Financial', 'FIN', 'HCF-5.5.2', 'Top',
 '2026-08-07', 'Email', 'Enrollee', 'Healthcare Facility',
 'Mr. James Ngwo', '2026-08-08', 'Closed', 'Complaint acknowledged',
 'Fee reversed; enrollee refunded.', 0, NULL, NULL, NULL,
 4, 1, '2026-08-11', 'Resolved', 'Closed within SLA — demo seed.',
 'Receipt and management of any enrollee as a fee-paying patient.',
 'SLA Demo Seed', NOW(), NOW()),

-- ── HIGH PRIORITY (6 rows) ──────────────────────────────────────────────────

-- #9  WHITE — received today
('CMP-2026-00017', 4, 22, 2026,
 '2026-08-12', 'Enrollee', 'Communication', NULL, 'Relationship', 'REL', NULL, 'High',
 '2026-08-12', 'Email', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Poor communication from provider desk on NHIA benefit package.',
 'SLA Demo Seed', NOW(), NOW()),

-- #10 WHITE — investigation started within 1 working day
('CMP-2026-00018', 1, 2, 2026,
 '2026-08-11', 'HMO', 'Operational', NULL, 'Operational', 'OPS', NULL, 'High',
 '2026-08-11', 'Portal', 'HMO', 'NHIA',
 'Mr. Yusuf Abdullahi', '2026-08-12', 'Under Investigation', 'Complaint acknowledged',
 'Reviewing HMO remittance records.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'HMO portal access issues blocking claims submission for 48 hours.',
 'SLA Demo Seed', NOW(), NOW()),

-- #11 YELLOW — not acknowledged (2 working days)
('CMP-2026-00019', 3, 20, 2026,
 '2026-08-10', 'HCF', 'Quality of Care', 'HCF-QOC-001', 'Service Delivery', 'SVC', 'HCF-5.5.28', 'High',
 '2026-08-10', 'Walk-in', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Deliberate under-management of enrollee contrary to clinical guidelines.',
 'SLA Demo Seed', NOW(), NOW()),

-- #12 AMBER — acknowledged, investigation not commenced (3 working days > 2d limit)
('CMP-2026-00020', 2, 9, 2026,
 '2026-08-07', 'Enrollee', 'Referral', NULL, 'Access', 'ACC', NULL, 'High',
 '2026-08-07', 'Hotline', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', 'Complaint acknowledged', 'Officer on leave; reassignment pending.',
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Facility refused referral to specialist despite NHIA coverage.',
 'SLA Demo Seed', NOW(), NOW()),

-- #13 RED — escalation overdue (8 working days > 7d limit)
('CMP-2026-00021', 5, 31, 2026,
 '2026-07-31', 'HCF', 'Fraud', 'HCF-FRD-001', 'Financial', 'FIN', 'HCF-5.5.5', 'High',
 '2026-07-31', 'Letter', 'NHIA Staff', 'Healthcare Facility',
 'Dr. Amina Lawal', '2026-08-04', 'Under Investigation', 'Complaint acknowledged',
 'Evidence collection ongoing; escalation threshold passed.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Engaging in fraudulent activity against the Authority.',
 'SLA Demo Seed', NOW(), NOW()),

-- #14 Escalated — open at escalation stage (for stage workflow testing)
('CMP-2026-00022', 4, 22, 2026,
 '2026-08-05', 'HMO', 'Billing', NULL, 'Financial', 'FIN', NULL, 'High',
 '2026-08-05', 'Email', 'Healthcare Facility', 'HMO',
 'Mrs. Grace Etim', '2026-08-06', 'Escalated', 'Complaint acknowledged',
 'Escalated to zonal director for intervention.', 1, 'Level 2', '2026-08-11', 'Zonal Director',
 NULL, NULL, NULL, NULL, NULL,
 'Capitation underpayment affecting drug stock availability.',
 'SLA Demo Seed', NOW(), NOW()),

-- ── MEDIUM PRIORITY (7 rows) ────────────────────────────────────────────────

-- #15 WHITE — received today
('CMP-2026-00023', 3, 14, 2026,
 '2026-08-12', 'Enrollee', 'Staffing & Resources', NULL, 'Operational', 'OPS', NULL, 'Medium',
 '2026-08-12', 'Phone', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Insufficient NHIA desk staff during peak hours.',
 'SLA Demo Seed', NOW(), NOW()),

-- #16 WHITE — 1 working day, still within 2-day acknowledge window
('CMP-2026-00024', 1, 3, 2026,
 '2026-08-11', 'HCF', 'Communication', 'HCF-COM-001', 'Relationship', 'REL', 'HCF-5.5.24', 'Medium',
 '2026-08-11', 'Email', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Poor provider-stakeholder communication on NHIA policy changes.',
 'SLA Demo Seed', NOW(), NOW()),

-- #17 YELLOW — not acknowledged (3 working days > 2d limit)
('CMP-2026-00025', 2, 9, 2026,
 '2026-08-07', 'Enrollee', 'Access', NULL, 'Access', 'ACC', NULL, 'Medium',
 '2026-08-07', 'Walk-in', 'Enrollee', 'Healthcare Facility',
 NULL, NULL, 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Long queue at NHIA verification desk exceeding 2 hours.',
 'SLA Demo Seed', NOW(), NOW()),

-- #18 AMBER — acknowledged, investigation not commenced (4 working days > 3d limit)
('CMP-2026-00026', 4, 22, 2026,
 '2026-08-06', 'HMO', 'Administrative', NULL, 'Operational', 'OPS', NULL, 'Medium',
 '2026-08-06', 'Portal', 'HMO', 'NHIA',
 NULL, NULL, 'New/Acknowledged', 'Complaint acknowledged', 'Pending assignment to state desk.',
 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'HMO failed to submit monthly NHIA returns on time.',
 'SLA Demo Seed', NOW(), NOW()),

-- #19 RED — escalation overdue (17 working days > 14d limit)
('CMP-2026-00027', 3, 20, 2026,
 '2026-07-20', 'HCF', 'Administrative', 'HCF-ADM-002', 'Operational', 'OPS', 'HCF-5.5.12', 'Medium',
 '2026-07-20', 'Letter', 'Enrollee', 'Healthcare Facility',
 'Mr. Ibrahim Musa', '2026-07-25', 'Under Investigation', 'Complaint acknowledged',
 'Prolonged investigation; escalation deadline exceeded.', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 'Failure to submit claims within the stipulated period.',
 'SLA Demo Seed', NOW(), NOW()),

-- #20 WHITE — closed within Medium SLA
('CMP-2026-00028', 5, 31, 2026,
 '2026-08-01', 'Enrollee', 'Abuse', NULL, 'Relationship', 'REL', NULL, 'Medium',
 '2026-08-01', 'Hotline', 'Enrollee', 'Healthcare Facility',
 'Mrs. Grace Etim', '2026-08-04', 'Closed', 'Complaint acknowledged',
 'Counselling provided; matter resolved amicably.', 0, NULL, NULL, NULL,
 7, 1, '2026-08-08', 'Resolved', 'Closed within Medium SLA — demo seed.',
 'Staff used inappropriate language toward enrollee at registration.',
 'SLA Demo Seed', NOW(), NOW());

-- =============================================================================
-- EXPECTED SLA COLOURS / FLAGS (as of 2026-08-12)
-- -----------------------------------------------------------------------------
-- CMP-2026-00009  Top    White   none
-- CMP-2026-00010  Top    White   none (investigation on track)
-- CMP-2026-00011  Top    Yellow  Not acknowledged within SLA
-- CMP-2026-00012  Top    Amber   Investigation did not commence
-- CMP-2026-00013  Top    Yellow  Investigation in progress (no flag)
-- CMP-2026-00014  Top    Red     Not escalated within SLA
-- CMP-2026-00015  Top    Red     Not escalated + Resolution target exceeded
-- CMP-2026-00016  Top    White   closed
-- CMP-2026-00017  High   White   none
-- CMP-2026-00018  High   White   none
-- CMP-2026-00019  High   Yellow  Not acknowledged within SLA
-- CMP-2026-00020  High   Amber   Investigation did not commence
-- CMP-2026-00021  High   Red     Not escalated within SLA
-- CMP-2026-00022  High   varies  Escalated (open)
-- CMP-2026-00023  Medium White   none
-- CMP-2026-00024  Medium White   none
-- CMP-2026-00025  Medium Yellow  Not acknowledged within SLA
-- CMP-2026-00026  Medium Amber   Investigation did not commence
-- CMP-2026-00027  Medium Red     Not escalated + Resolution target exceeded
-- CMP-2026-00028  Medium White   closed
-- =============================================================================
