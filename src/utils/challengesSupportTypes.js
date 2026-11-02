/**
 * Challenges & Support catalogue — Challenges and Support .xlsx + Forms deck.
 * Keep in sync with urms-fronted/src/components/stateOffice/challengesTypes.ts
 */
const OTHER_OPTION = "Other (Specify)";

const CHALLENGE_CATEGORIES = [
  { code: "CH-001", key: "Financial_Funding", label: "Financial Funding" },
  { code: "CH-002", key: "Political", label: "Political" },
  { code: "CH-003", key: "Operational_Logistics", label: "Operational Logistics" },
  { code: "CH-004", key: "Policy_Regulation", label: "Policy Regulation" },
  { code: "CH-005", key: "HR_Staffing", label: "HR Staffing" },
  { code: "CH-006", key: "Technology_ICT", label: "Technology ICT" },
  { code: "CH-007", key: "Infrastructure", label: "Infrastructure" },
  { code: "CH-008", key: "Security", label: "Security" },
  { code: "CH-009", key: "Data_Reporting", label: "Data & Reporting" },
  { code: "CH-010", key: "Program_Implementation", label: "Program Implementation" },
  { code: "CH-011", key: "Communication_Awareness", label: "Communication Awareness" },
  { code: "CH-012", key: "Coordination", label: "Monitoring & Coordination" },
  { code: "CH-013", key: "Procurement", label: "Procurement" },
  { code: "CH-014", key: "ProviderMangement", label: "Provider Management" },
  { code: "CH-015", key: "BeneficiaryManagement", label: "Beneficiary Management" },
];

const CHALLENGE_SPECIFICS = {
  Financial_Funding: ["Inadequate funding", "Premium payment delay", "Funding constraint"],
  Political: ["Political interference"],
  Operational_Logistics: ["Poor logistics for activity", "Electricity Challenges", "Power supply problem"],
  Policy_Regulation: ["Operational Guideline issues"],
  HR_Staffing: ["Limited staff", "Insufficient staffing/Staff shortage", "Staff turnover", "Staff capacity gap", "Lack of specialised skills", "Staff deployment issue", "Excessive workload"],
  Technology_ICT: ["Network failure", "ICT downtime", "Poor internet connectivity", "System downtime", "Hardware shortage", "Software/system issue", "Lack of technical support"],
  Infrastructure: ["Insufficient storage", "Outdated IT Systems"],
  Security: ["Security challenge"],
  Data_Reporting: ["Poor documentation", "Incomplete records", "Duplicate Data", "Inconsistent data", "Difficulty accessing data", "Late submission", "Incomplete submission", "Missing information", "Poor data quality"],
  Program_Implementation: ["Implementation delay", "Low enrolment"],
  Communication_Awareness: ["Poor attendance", "Lack of IEC materials", "Lack of Awareness/Low awareness", "Stakeholder resistance", "Low stakeholder participation", "Programme awareness gap"],
  Coordination: ["Delayed approvals", "Poor partner response", "Employer delay", "Delayed stakeholder response", "Coordination problem", "Delayed approval", "Provider cooperation issue"],
  Procurement: ["Delayed procurement approvals"],
  ProviderMangement: ["Accreditation delay", "Reaccreditation issue", "Provider compliance issue", "Difficulty accessing provider"],
  BeneficiaryManagement: ["NIN verification issues", "Beneficiary not available", "Omission of names from enrolee register", "Delayed Activation/Re-activation for GIFSHIP/Extra dependent", "ID Card Issues", "Enrolee data update"],
};

const CHALLENGE_SEVERITIES = ["Low", "Medium", "High", "Critical"];
const CHALLENGE_IMPACTS = ["No significant impact", "Delayed activity", "Reduced activity/output", "Reduced enrolment", "Delayed reporting", "Reduced service quality", "Increased operational cost", "Affected stakeholder engagement", "Affected beneficiary services", "Affected provider management", "Compliance risk", "Financial risk", "Other"];
const CHALLENGE_STATUSES = ["In-progress", "Resolved", "Escalated", "Under Review", "Action Initiated", "Closed", "No Further Action Required"];
const CHALLENGE_RELATED_ACTIVITIES = ["Enrolment / Enrolee Update", "Enrolment Drives", "Stakeholder Engagement", "Internal Operations", "Provider Management", "Complaint Management"];
const CHALLENGE_PROGRAMS = ["FSSHIP", "OPS", "GIFSHIP", "BHCPF", "TISHIP", "CEmONC", "FFP", "CBSHIP"];
const CHALLENGE_DEPARTMENTS = ["Internal Audit", "Procurement", "DG/CEO", "SQA", "Legal", "PRSD", "Finance & Account", "HRMD", "Enforcement", "ISD", "FSD", "CMD", "ICT", "Strategic & Purchasing", "Risk & Regulatory", "SDO"];

const SUPPORT_ACTION_OWNERS = ["State Office", "Zonal Office", "SDO", "Other NHIA Departments", "Management", "External Stakeholder", OTHER_OPTION];
const SUPPORT_CATEGORY_SPECIFICS = {
  "Policy, Legal and Regulatory": ["HQ approval", "Legal/regulatory clarification", "Policy direction from Management"],
  "Funding and Procurement": ["Additional funding", "Procurement support"],
  "Human Resources and Capacity Building": ["Additional staff", "Training and capacity building"],
  "ICT and Infrastructure": ["ICT support", "Vehicle/logistics support", "Security support for field activities"],
  "Programme Implementation, Monitoring and Coordination": ["Zonal Office support", "Programme support", "Monitoring and supervision support", "Inter-departmental coordination"],
  "Stakeholder Engagement and Public Awareness": ["Public awareness/IEC materials", "Engagement with State Government", "Engagement with Health Maintenance Organizations (HMOs)", "Engagement with Healthcare Providers"],
  Others: ["Specify"],
};
const SUPPORT_CATEGORIES = Object.keys(SUPPORT_CATEGORY_SPECIFICS);
const SUPPORT_STATUSES = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Closed", "Returned for Clarification"];
const SUPPORT_PRIORITIES = ["Critical", "High", "Medium", "Low"];

module.exports = {
  OTHER_OPTION,
  CHALLENGE_CATEGORIES, CHALLENGE_SPECIFICS, CHALLENGE_SEVERITIES, CHALLENGE_IMPACTS,
  CHALLENGE_STATUSES, CHALLENGE_RELATED_ACTIVITIES, CHALLENGE_PROGRAMS, CHALLENGE_DEPARTMENTS,
  SUPPORT_ACTION_OWNERS, SUPPORT_CATEGORY_SPECIFICS, SUPPORT_CATEGORIES, SUPPORT_STATUSES, SUPPORT_PRIORITIES,
};
