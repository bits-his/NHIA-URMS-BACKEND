require("dotenv").config();
const sequelize  = require("../config/database");
require("../models/index");
const Department = require("../models/Department");
const Unit       = require("../models/Unit");

// ─── NHIA Departments & Units ─────────────────────────────────────────────────
const DEPARTMENTS = [
  {
    department_code: "FIN",
    name: "Finance & Accounts",
    description: "Manages all financial operations, budgeting, revenue and expenditure reporting.",
    units: [
      { unit_code: "FIN-REV",  name: "Revenue & IGR Unit",       description: "Internally Generated Revenue tracking and reporting." },
      { unit_code: "FIN-EXP",  name: "Expenditure & Budget Unit", description: "Budget planning, monitoring and expenditure control." },
      { unit_code: "FIN-ACC",  name: "Accounts & Reconciliation", description: "Financial reconciliation, ledger management and audit support." },
      { unit_code: "FIN-PAY",  name: "Payroll Unit",              description: "Staff payroll processing and remittances." },
    ],
  },
  {
    department_code: "HI",
    name: "Health Insurance",
    description: "Oversees enrolment, claims processing, and health insurance scheme management.",
    units: [
      { unit_code: "HI-ENR",   name: "Enrolment & Registration",  description: "GIFSHIP, FSSHIP, BHCPF and other scheme enrolments." },
      { unit_code: "HI-CLM",   name: "Claims Processing Unit",     description: "Verification and processing of health insurance claims." },
      { unit_code: "HI-HCF",   name: "HCF Accreditation Unit",     description: "Accreditation and re-accreditation of healthcare facilities." },
      { unit_code: "HI-QA",    name: "Quality Assurance Unit",     description: "Mystery shopping, QA visits and compliance monitoring." },
    ],
  },
  {
    department_code: "ICT",
    name: "ICT & Digital Services",
    description: "Manages information systems, digital infrastructure and data management.",
    units: [
      { unit_code: "ICT-SYS",  name: "Systems & Infrastructure",  description: "Server management, network and IT infrastructure." },
      { unit_code: "ICT-DATA", name: "Data Management Unit",       description: "Database administration, data integrity and reporting." },
      { unit_code: "ICT-DEV",  name: "Software Development Unit",  description: "Development and maintenance of NHIA digital platforms." },
      { unit_code: "ICT-SUP",  name: "IT Support Unit",            description: "End-user support, hardware and software troubleshooting." },
    ],
  },
  {
    department_code: "AUD",
    name: "Audit & Compliance",
    description: "Internal audit, risk management and regulatory compliance oversight.",
    units: [
      { unit_code: "AUD-INT",  name: "Internal Audit Unit",        description: "Periodic internal audits of financial and operational activities." },
      { unit_code: "AUD-RISK", name: "Risk Management Unit",       description: "Identification, assessment and mitigation of operational risks." },
      { unit_code: "AUD-COMP", name: "Compliance & Enforcement",   description: "Regulatory compliance monitoring and enforcement actions." },
    ],
  },
  {
    department_code: "HR",
    name: "Human Resources",
    description: "Staff recruitment, welfare, training, performance and records management.",
    units: [
      { unit_code: "HR-REC",   name: "Recruitment & Placement",    description: "Staff recruitment, onboarding and placement." },
      { unit_code: "HR-TRN",   name: "Training & Development",     description: "Capacity building, training programmes and staff development." },
      { unit_code: "HR-WEL",   name: "Staff Welfare Unit",         description: "Staff welfare, leave management and benefits administration." },
      { unit_code: "HR-REC2",  name: "Records & Documentation",    description: "Staff records, personnel files and HR documentation." },
    ],
  },
  {
    department_code: "PLN",
    name: "Planning, Research & Statistics",
    description: "Strategic planning, policy research, data analysis and statistical reporting.",
    units: [
      { unit_code: "PLN-STR",  name: "Strategic Planning Unit",    description: "Corporate strategy, annual plans and performance targets." },
      { unit_code: "PLN-RES",  name: "Research & Policy Unit",     description: "Health insurance policy research and evidence generation." },
      { unit_code: "PLN-STAT", name: "Statistics & Reporting",     description: "National data aggregation, statistical analysis and reporting." },
    ],
  },
  {
    department_code: "SVC",
    name: "SERVICOM",
    description: "Customer satisfaction, complaints management and service delivery standards.",
    units: [
      { unit_code: "SVC-CMP",  name: "Complaints Management Unit", description: "Registration, tracking and resolution of customer complaints." },
      { unit_code: "SVC-SAT",  name: "Customer Satisfaction Unit", description: "Satisfaction surveys, feedback analysis and service improvement." },
      { unit_code: "SVC-STD",  name: "Service Standards Unit",     description: "Service charter development and compliance monitoring." },
    ],
  },
  {
    department_code: "SPD",
    name: "Special Projects Division",
    description: "Coordination and monitoring of special health programmes and strategic projects.",
    units: [
      { unit_code: "SPD-CEM",  name: "CEmONC Programme Unit",      description: "Comprehensive Emergency Obstetric & Newborn Care programme." },
      { unit_code: "SPD-FFP",  name: "FFP Programme Unit",         description: "Free Family Planning programme coordination." },
      { unit_code: "SPD-BHCPF",name: "BHCPF Coordination Unit",    description: "Basic Health Care Provision Fund programme management." },
      { unit_code: "SPD-PROJ", name: "Projects Monitoring Unit",   description: "Monitoring and evaluation of special projects and directives." },
    ],
  },
  {
    department_code: "STK",
    name: "Stock Verification Division",
    description: "Asset management, stock verification and inventory control across state offices.",
    units: [
      { unit_code: "STK-VER",  name: "Stock Verification Unit",    description: "Periodic stock-taking and physical verification of assets." },
      { unit_code: "STK-AST",  name: "Asset Management Unit",      description: "Asset register maintenance, tagging and disposal." },
      { unit_code: "STK-INV",  name: "Inventory Control Unit",     description: "Inventory tracking, procurement support and store management." },
    ],
  },
  {
    department_code: "LEG",
    name: "Legal Services",
    description: "Legal advisory, contract management and litigation support.",
    units: [
      { unit_code: "LEG-ADV",  name: "Legal Advisory Unit",        description: "Legal opinions, regulatory interpretation and advisory services." },
      { unit_code: "LEG-CON",  name: "Contracts & Agreements",     description: "Drafting, review and management of contracts and MOUs." },
      { unit_code: "LEG-LIT",  name: "Litigation Unit",            description: "Management of court cases and dispute resolution." },
    ],
  },
  {
    department_code: "COM",
    name: "Communications & Public Affairs",
    description: "Media relations, public communications, advocacy and stakeholder engagement.",
    units: [
      { unit_code: "COM-MED",  name: "Media & Press Unit",         description: "Press releases, media appearances and public communications." },
      { unit_code: "COM-ADV",  name: "Advocacy & Sensitization",   description: "Community outreach, advocacy campaigns and sensitization." },
      { unit_code: "COM-STK",  name: "Stakeholder Relations Unit", description: "Stakeholder meetings, partnerships and engagement management." },
    ],
  },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    await sequelize.sync({ alter: true });
    console.log("✅  Tables synced");

    let deptCount = 0;
    let unitCount = 0;

    for (const dept of DEPARTMENTS) {
      const { units, ...deptData } = dept;

      // Upsert department
      const [deptRecord] = await Department.upsert(deptData);
      const deptId = deptRecord.id;
      deptCount++;

      // Upsert each unit
      for (const unit of units) {
        await Unit.upsert({ ...unit, department_id: deptId });
        unitCount++;
      }

      console.log(`  ✔  ${dept.name} (${units.length} units)`);
    }

    console.log(`\n✅  ${deptCount} departments seeded`);
    console.log(`✅  ${unitCount} units seeded`);
    console.log("\n🎉  Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
