/**
 * Org catalog: departments, units, and the URMS pages each unit owns.
 * Privilege titles must match MODULE_CONFIG leaf titles exactly.
 */

const CORE = [
  { access_to: "Dashboard", functionalities: ["Dashboard"] },
  { access_to: "Notifications", functionalities: ["Notifications"] },
];

function pack(access_to, ...functionalities) {
  return { access_to, functionalities };
}

const DEPARTMENTS = [
  {
    department_code: "FSD",
    name: "Formal Sector / Enrolment",
    description: "Enrolment, beneficiary record updates and enrolment drives (diagram FSD/PRSD).",
    units: [
      { unit_code: "FSD-ENR", name: "Enrolment & Registration", description: "Monthly enrolment activity reporting.", access: [pack("Zonal", "Enrolment"), pack("Programmes", "Programmes Report"), pack("SOC/Zones", "Monthly Enrollee Register")] },
      { unit_code: "FSD-DEP", name: "Extra / Additional Dependant", description: "Additional and extra dependant requests.", access: [pack("Zonal", "Additional / Extra Dependant")] },
      { unit_code: "FSD-HCF", name: "Change of HCF", description: "Healthcare facility change requests.", access: [pack("Zonal", "Change of HCF")] },
      { unit_code: "FSD-OUT", name: "Enrolment Drives & Outreach", description: "Sensitization, campaigns and outreach.", access: [pack("Programmes", "Outreach Report")] },
    ],
  },
  {
    department_code: "PRSD",
    name: "Planning, Research & Statistics",
    description: "Stakeholder coordination and statistical reporting (diagram ISP/PRSD).",
    units: [
      { unit_code: "PRSD-STR", name: "Strategic Planning", description: "Corporate strategy and work plans.", access: [] },
      { unit_code: "PRSD-STK", name: "Stakeholder / SSHIA Coordination", description: "Meetings with SSHIAs and stakeholder forums.", access: [pack("Zonal", "Stakeholder Engagement")] },
      { unit_code: "PRSD-STAT", name: "Statistics & Reporting", description: "Data aggregation and statistical reports.", access: [] },
    ],
  },
  {
    department_code: "SPD",
    name: "Special Projects",
    description: "HMO selection and ad-hoc / special assignments.",
    units: [
      { unit_code: "SPD-HMO", name: "HMO Selection", description: "MDA HMO selection process.", access: [pack("Zonal", "HMO Selection Process")] },
      { unit_code: "SPD-PROJ", name: "Projects Monitoring", description: "Ad-hoc and special assignments.", access: [pack("SDO", "Ad-hoc / Special Assignment")] },
      { unit_code: "SPD-CEM", name: "CEmONC Programme", description: "CEmONC programme coordination.", access: [] },
      { unit_code: "SPD-FFP", name: "FFP Programme", description: "Free Family Planning programme.", access: [] },
      { unit_code: "SPD-BHCPF", name: "BHCPF Coordination", description: "Basic Health Care Provision Fund.", access: [] },
    ],
  },
  {
    department_code: "SQA",
    name: "Standards & Quality Assurance",
    description: "Accreditation, facility compliance and QA visits (diagram SQA).",
    units: [
      { unit_code: "SQA-ACC", name: "Accreditation / Reaccreditation", description: "Provider accreditation.", access: [pack("Zonal", "Accreditation / Reaccreditation")] },
      { unit_code: "SQA-CMP", name: "Facility Compliance", description: "Facility compliance template and SQA monthly pack.", access: [pack("Standards & Quality Assurance", "Compliance Management", "SQA Report")] },
      { unit_code: "SQA-MYS", name: "Mystery Shopping & QA Visits", description: "Mystery shopping and monitoring visits.", access: [pack("Zonal", "Mystery Shopping", "Monitoring Visits")] },
    ],
  },
  {
    department_code: "ENF",
    name: "Enforcement",
    description: "Complaints, compliance enforcement and HMO indebtedness (diagram Enforcement).",
    units: [
      { unit_code: "ENF-CMP", name: "Complaints & Compliance", description: "Complaints resolution and register.", access: [pack("Standards & Quality Assurance", "Complaints Report"), pack("SDO", "Complaints Management")] },
      { unit_code: "ENF-HMO", name: "HMO Indebtedness", description: "Reconciliation and HMO indebtedness collation.", access: [pack("Zonal", "HMO Indebtedness Collation")] },
      { unit_code: "ENF-ACT", name: "Enforcement Actions", description: "Compliance and enforcement actions.", access: [pack("Standards & Quality Assurance", "Compliance Management")] },
    ],
  },
  {
    department_code: "FIN",
    name: "Finance & Accounts",
    description: "IGR, SSHIA, expenditure and finance monthly reporting (diagram F&A).",
    units: [
      { unit_code: "FIN-REV", name: "Revenue & IGR", description: "Internally generated revenue.", access: [pack("Zonal", "IGR")] },
      { unit_code: "FIN-SSH", name: "SSHIA Financial", description: "SSHIA financial progress reports.", access: [pack("Zonal", "SSHIA Financial Report")] },
      { unit_code: "FIN-EXP", name: "Expenditure & Budget", description: "Overhead expenditure and finance monthly pack.", access: [pack("Zonal", "Expenditure Profile"), pack("Finance & Admin Dept", "Finance Report")] },
      { unit_code: "FIN-ACC", name: "Accounts & Reconciliation", description: "Challenges and financial reconciliation notes.", access: [pack("Zonal", "Challenges & Recommendations")] },
      { unit_code: "FIN-PAY", name: "Payroll", description: "Staff payroll processing.", access: [] },
    ],
  },
  {
    department_code: "HR",
    name: "Human Resources / Admin",
    description: "Office admin, ETMC cascading, facilities and infractions (diagram Admin/HR).",
    units: [
      { unit_code: "HR-ADM", name: "Office Administration", description: "Meetings, accommodation, utilities and vehicles.", access: [pack("Zonal", "State Office Meeting Report", "Office Accommodation", "Utility Services", "Vehicle Maintenance")] },
      { unit_code: "HR-ETM", name: "ETMC / Cascading", description: "ETMC cascading reports.", access: [pack("Zonal", "ETMC Cascading Report")] },
      { unit_code: "HR-WEL", name: "Staff Welfare & Records", description: "Admin monthly pack and infractions.", access: [pack("Finance & Admin Dept", "Admin Report"), pack("Zonal", "Conflict / Infraction Report")] },
      { unit_code: "HR-REC", name: "Recruitment & Placement", description: "Recruitment and onboarding.", access: [] },
      { unit_code: "HR-TRN", name: "Training & Development", description: "Capacity building.", access: [] },
    ],
  },
  {
    department_code: "ICT",
    name: "ICT & Digital Services",
    description: "ICT support desk and ICT support register.",
    units: [
      { unit_code: "ICT-SUP", name: "IT Support", description: "End-user support and ICT support register.", access: [pack("Zonal ICT Support", "ICT Support Desk"), pack("Zonal", "ICT Support Register")] },
      { unit_code: "ICT-SYS", name: "Systems & Infrastructure", description: "Systems and network.", access: [pack("Zonal ICT Support", "Systems & Network")] },
      { unit_code: "ICT-DATA", name: "Data Management", description: "Database and reporting support.", access: [] },
      { unit_code: "ICT-DEV", name: "Software Development", description: "NHIA digital platforms.", access: [] },
    ],
  },
  {
    department_code: "SVC",
    name: "SERVICOM",
    description: "Charter, complaints and customer satisfaction (SDO portal SERVICOM).",
    units: [
      { unit_code: "SVC-CMP", name: "Complaints Management", description: "Complaints register.", access: [pack("SDO", "Complaints Management")] },
      { unit_code: "SVC-SAT", name: "Customer Satisfaction", description: "Satisfaction surveys and enrollee feedback.", access: [pack("SDO", "HCF Customer Satisfaction Survey"), pack("Zonal", "Enrollee Feedback Survey")] },
      { unit_code: "SVC-STD", name: "Service Standards / Charter", description: "Citizen comment card and SERVICOM dashboard.", access: [pack("SDO", "Charter Performance", "SERVICOM Dashboard")] },
    ],
  },
  {
    department_code: "STK",
    name: "Stock Verification",
    description: "Asset and supply verification and store inventory.",
    units: [
      { unit_code: "STK-VER", name: "Stock Verification", description: "Physical asset and supply verification.", access: [pack("SDO", "Physical Asset Verification", "Verification of Supply")] },
      { unit_code: "STK-AST", name: "Asset Management", description: "Stock dashboard and prepayment analysis.", access: [pack("SDO", "Stock Verification Dashboard", "Prepayment Analysis Register")] },
      { unit_code: "STK-INV", name: "Inventory / Stores", description: "Inventory register and issuance.", access: [pack("SDO", "Inventory Register", "Capitalisation & Issuance")] },
    ],
  },
  {
    department_code: "COM",
    name: "Communications & Public Affairs",
    description: "Outreach, media and stakeholder relations (diagram MEDIA).",
    units: [
      { unit_code: "COM-MED", name: "Media & Press", description: "Media parley and campaigns (reported via outreach).", access: [pack("Programmes", "Outreach Report")] },
      { unit_code: "COM-ADV", name: "Advocacy & Sensitization", description: "Community outreach and campaigns.", access: [pack("Programmes", "Outreach Report")] },
      { unit_code: "COM-STK", name: "Stakeholder Relations", description: "Stakeholder engagement.", access: [pack("Zonal", "Stakeholder Engagement")] },
    ],
  },
  {
    department_code: "SOC",
    name: "State Office Coordination",
    description: "SOC/Zones office profile, focal persons and escalations.",
    units: [
      { unit_code: "SOC-PRF", name: "Office Profile", description: "State/zonal office profile.", access: [pack("SOC/Zones", "SOC/Zones Dashboard", "State/Zonal Office Profile")] },
      { unit_code: "SOC-FOC", name: "Focal Persons", description: "Focal persons register.", access: [pack("SOC/Zones", "State/Zonal Focal Persons Register")] },
      { unit_code: "SOC-ETM", name: "ETMC Action Points", description: "ETMC/TMC action-point register.", access: [pack("SOC/Zones", "ETMC/TMC Action-Point Register")] },
      { unit_code: "SOC-ESC", name: "Escalations", description: "Weekly actionable / escalated issues.", access: [pack("SOC/Zones", "Weekly Actionable")] },
      { unit_code: "SOC-CON", name: "Contracted Services", description: "Contracted services register.", access: [pack("SOC/Zones", "Contracted Services")] },
    ],
  },
];

function mergeAccess(list) {
  const map = new Map();
  for (const entry of list) {
    if (!entry?.access_to) continue;
    if (!map.has(entry.access_to)) map.set(entry.access_to, new Set());
    for (const title of entry.functionalities || []) map.get(entry.access_to).add(title);
  }
  return [...map.entries()]
    .map(([access_to, set]) => ({ access_to, functionalities: [...set] }))
    .filter((e) => e.functionalities.length > 0);
}

function accessForDepartment(code) {
  const dept = DEPARTMENTS.find((d) => d.department_code === code);
  if (!dept) return [...CORE];
  return mergeAccess([...CORE, ...dept.units.flatMap((u) => u.access || [])]);
}

function accessForUnit(unitCode) {
  for (const dept of DEPARTMENTS) {
    const unit = dept.units.find((u) => u.unit_code === unitCode);
    if (unit) return mergeAccess([...CORE, ...(unit.access || [])]);
  }
  return [...CORE];
}

module.exports = {
  CORE,
  DEPARTMENTS,
  mergeAccess,
  accessForDepartment,
  accessForUnit,
};
