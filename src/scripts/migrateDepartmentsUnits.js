/**
 * Seed official NHIA departments and units (idempotent upsert).
 * Run: node src/scripts/migrateDepartmentsUnits.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");
const Department = require("../models/Department");
const Unit = require("../models/Unit");

const DEPARTMENTS = [
  {
    department_code: "FSD",
    name: "Formal Sector Department",
    units: [
      { unit_code: "FSD-PS",  name: "Public Sector" },
      { unit_code: "FSD-OPS", name: "Organized Private Sector" },
      { unit_code: "FSD-MDA", name: "Ministries, Departments & Agencies" },
    ],
  },
  {
    department_code: "ISD",
    name: "Informal Sector Department",
    units: [
      { unit_code: "ISD-EISHIP", name: "EISHIP" },
      { unit_code: "ISD-GIFSHIP", name: "GIFSHIP" },
      { unit_code: "ISD-VGSHIP", name: "VGSHIP" },
    ],
  },
  {
    department_code: "FAD",
    name: "Finance & Accounts Department",
    units: [
      { unit_code: "FAD-RIA", name: "Revenue, Investment & Accounts" },
      { unit_code: "FAD-EXP", name: "Expenditure" },
      { unit_code: "FAD-FFR", name: "Final & Fiscal Reporting" },
    ],
  },
  {
    department_code: "ICT",
    name: "ICT Department",
    units: [
      { unit_code: "ICT-DB",  name: "Database" },
      { unit_code: "ICT-SYS", name: "System Administration" },
      { unit_code: "ICT-NET", name: "Network Security & Communication" },
      { unit_code: "ICT-CMC", name: "Call Management Centre" },
      { unit_code: "ICT-CC",  name: "Call Centre" },
    ],
  },
  {
    department_code: "HRM",
    name: "Human Resources Management Department",
    units: [
      { unit_code: "HRM-APD", name: "Appointment, Promotion & Discipline" },
      { unit_code: "HRM-TSW", name: "Training & Staff Welfare" },
      { unit_code: "HRM-GS",  name: "General Services" },
    ],
  },
  {
    department_code: "PRS",
    name: "Planning, Research & Statistics Department",
    units: [
      { unit_code: "PRS-PP",  name: "Planning & Policy" },
      { unit_code: "PRS-RS",  name: "Research & Statistics" },
      { unit_code: "PRS-ME",  name: "Monitoring & Evaluation" },
    ],
  },
  {
    department_code: "SQA",
    name: "Standards & Quality Assurance Department",
    units: [
      { unit_code: "SQA-ACC", name: "Accreditation" },
      { unit_code: "SQA-HCF", name: "Healthcare Facilities" },
      { unit_code: "SQA-HMO", name: "HMOs & Allied Services" },
    ],
  },
  {
    department_code: "PROC",
    name: "Procurement Department",
    units: [
      { unit_code: "PROC-CAP", name: "Capital Procurement" },
      { unit_code: "PROC-REC", name: "Recurrent Procurement" },
    ],
  },
  {
    department_code: "CMD",
    name: "Contribution Management Department",
    units: [
      { unit_code: "CMD-CON", name: "Contribution" },
      { unit_code: "CMD-DIS", name: "Disbursement" },
      { unit_code: "CMD-REC", name: "Reconciliation" },
      { unit_code: "CMD-ENR", name: "Enrolment" },
    ],
  },
  {
    department_code: "ENF",
    name: "Enforcement Department",
    units: [
      { unit_code: "ENF-HMO", name: "Health Maintenance Organizations" },
      { unit_code: "ENF-INS", name: "Inspectorate" },
      { unit_code: "ENF-RMI", name: "Risk Management & Insurance Actuary" },
    ],
  },
  {
    department_code: "IAD",
    name: "Internal Audit Department",
    units: [
      { unit_code: "IAD-SYS", name: "System Audit" },
      { unit_code: "IAD-FIN", name: "Financial Audit" },
      { unit_code: "IAD-MGT", name: "Management Audit" },
    ],
  },
  {
    department_code: "BHCPF",
    name: "BHCFP Department",
    units: [
      { unit_code: "BHCPF-BUD", name: "Budget" },
    ],
  },
  {
    department_code: "LEG",
    name: "Legal Unit",
    units: [
      { unit_code: "LEG-LIT", name: "Litigation / Arbitration" },
      { unit_code: "LEG-COR", name: "Corporate & Secretarial Services" },
    ],
  },
  {
    department_code: "SDU",
    name: "Special Duties Unit",
    units: [
      { unit_code: "SDU-REF", name: "Reform (SERVICOM & ACTU)" },
      { unit_code: "SDU-STK", name: "Stock Verification" },
      { unit_code: "SDU-PRO", name: "Protocol" },
      { unit_code: "SDU-SOC", name: "State Offices Coordination" },
    ],
  },
  {
    department_code: "MPR",
    name: "Media & Public Relations Unit",
    units: [
      { unit_code: "MPR-PRESS", name: "Press" },
      { unit_code: "MPR-MKT",   name: "Marketing" },
    ],
  },
  {
    department_code: "OPS",
    name: "Operational Offices",
    units: [
      { unit_code: "OPS-STO", name: "State Offices" },
      { unit_code: "OPS-ZON", name: "Zonal Offices" },
    ],
  },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    let deptCount = 0;
    let unitCount = 0;

    for (const dept of DEPARTMENTS) {
      const { units, ...deptData } = dept;

      const [deptRecord] = await Department.upsert(deptData);
      const deptId = deptRecord.id;
      deptCount++;

      for (const unit of units) {
        await Unit.upsert({ ...unit, department_id: deptId });
        unitCount++;
      }

      console.log(`  ✔  ${dept.name} (${units.length} units)`);
    }

    console.log(`\n✅  ${deptCount} departments upserted`);
    console.log(`✅  ${unitCount} units upserted`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
