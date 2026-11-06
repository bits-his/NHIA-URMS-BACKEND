const entry = (access_to, functionalities) => ({ access_to, functionalities });
const SERVICOM_FORMS = ["Charter Performance", "Complaints Management", "HCF Customer Satisfaction Survey"];
const STOCK_FORMS = ["Physical Asset Verification", "Stock Prepayment Register", "Inventory Register", "Capitalisation & Issuance"];
const SOC_FORMS = ["State/Zonal Office Profile", "State/Zonal Focal Persons Register", "Monthly Enrollee Register", "ETMC/TMC Action-Point Register", "Weekly Actionable", "Contracted Services", "Operation Monitoring Visit", "Spot Check Visit", "Ad-hoc / Special Assignment"];
const COMPLIANCE_TABS = ["State Complaints Register", "Weekly Compliance Report", "HMO Indebtedness", "Mystery Shopping"];
const FINANCE_TABS = ["Internally Generated Revenue (IGR)", "SSHIA Financial Report", "Expenditure Profile"];
const STATE_FORMS = ["Enrolment", "Enrolment Drives", "Beneficiary Management", "Stakeholder Management", "Provider Management", ...COMPLIANCE_TABS, ...FINANCE_TABS, "State Office Meeting Report", "ETMC Cascading Report", "Office Accommodation", "Utility Services", "Vehicle Maintenance", "Conflict / Infraction Report", "Enrollee Feedback Survey", "ICT Support Register", "Charter Performance", "HCF Customer Satisfaction Survey", "Challenges & Recommendations", "Ad-hoc / Special Assignment", "State Office Dashboard", "Finance Dashboard"];
const DASHBOARDS = [entry("Dashboard", ["Dashboard"]), entry("SDO", ["SERVICOM Dashboard", "Stock Verification Dashboard"]), entry("Zonal", ["State Office Dashboard", "Finance Dashboard"])];
const STATE_DASHBOARDS = [entry("Dashboard", ["Dashboard"]), entry("Zonal", ["State Office Dashboard", "Finance Dashboard"])];
const ANNUAL = entry("Annual Reports", ["Annual Report"]);
const ALL_ACCESS = [entry("Dashboard", ["Dashboard"]), ANNUAL, entry("Standards & Quality Assurance", ["Compliance Management"]), entry("SDO", ["SERVICOM Dashboard", ...SERVICOM_FORMS, "Stock Verification Dashboard", ...STOCK_FORMS, "Ad-hoc / Special Assignment"]), entry("SOC/Zones", ["SOC/Zones Dashboard", ...SOC_FORMS]), entry("Zonal", [...STATE_FORMS, "Provider Management Dashboard"]), entry("Notifications", ["Notifications"]), entry("Settings", ["Settings"])];

function profile(staff_id, role, name, department_code, report_scope, can_create_monthly, can_review_monthly, access, annualOnly = false) {
  return { staff_id, role, name, department_code, report_scope, can_create_monthly, can_review_monthly, access, annualOnly };
}

const DOCUMENT_USER_PROFILES = [
  profile("SDO-0001", "sdo", "Special Duties Office (SDO)", null, "national", true, true, ALL_ACCESS),
  profile("SVCSC-0001", "svc-state-coordinator", "Head SERVICOM Division", "SVC", "national", false, true, [entry("SDO", ["SERVICOM Dashboard", ...SERVICOM_FORMS])]),
  profile("SVCRO-0001", "svc-reporting-officer", "SERVICOM Reporting Officer", "SVC", "state", true, false, [entry("SDO", SERVICOM_FORMS)]),
  profile("STKSC-0001", "stk-state-coordinator", "Head Stock Verification Division", "STK", "national", false, true, [entry("SDO", ["Stock Verification Dashboard", ...STOCK_FORMS])]),
  profile("STKRO-0001", "stk-reporting-officer", "Stock Verification Reporting Officer", "STK", "state", true, false, [entry("SDO", STOCK_FORMS)]),
  profile("SOCSC-0001", "soc-state-coordinator", "Head State Office Coordination", "SOC", "national", false, false, STATE_DASHBOARDS),
  profile("SOCRO-0001", "soc-reporting-officer", "State Office Coordination Reporting Officer", "SOC", "state", true, false, [entry("SOC/Zones", SOC_FORMS)]),
  profile("SPDSC-0001", "spd-state-coordinator", "Head Special Projects Unit", "SPD", "national", false, false, [entry("Dashboard", ["Dashboard"])]),
  profile("SPDRO-0001", "spd-reporting-officer", "Special Project Reporting Officer", "SPD", "state", true, false, [entry("SDO", ["Ad-hoc / Special Assignment"])]),
  profile("SC-0001", "state-coordinator", "State Coordinator", null, "state", false, true, [...STATE_DASHBOARDS, entry("Zonal", STATE_FORMS), ANNUAL]),
  profile("SOCZC-0001", "soc-zonal-coordinator", "State Office Coordination Zonal Coordinator", "SOC", "zonal", false, true, [...STATE_DASHBOARDS, entry("Zonal", STATE_FORMS), ANNUAL]),
  profile("SORO-0001", "state-officer", "State Office Reporting Officer (KN)", "SOC", "state", true, false, [entry("Zonal", STATE_FORMS)]),
  profile("ENFZC-0001", "enf-zonal-coordinator", "Director Enforcement (ENF)", "ENF", "national", false, false, [entry("Dashboard", ["Dashboard"])]),
  profile("FINZC-0001", "fin-zonal-coordinator", "Director Finance and Admin (F&A)", "FIN", "national", false, false, [entry("Dashboard", ["Dashboard"])]),
  profile("FSDZC-0001", "fsd-zonal-coordinator", "Director Formal Sector (FSD)", "FSD", "national", false, true, [entry("Zonal", ["Enrolment", "Beneficiary Management"])]),
  profile("DG-0001", "dg-ceo", "Director-General / CEO", null, "national", false, false, [...DASHBOARDS, ANNUAL]),
];

function documentRoleOverrides(role) {
  const spec = DOCUMENT_USER_PROFILES.find((item) => item.role === role.key);
  return spec ? { ...role, label: spec.role === "state-officer" ? "State Office Reporting Officer" : spec.name, staff_id_prefix: spec.staff_id.replace(/-\d+$/, ""), report_scope: spec.report_scope, can_create_monthly: spec.can_create_monthly, can_review_monthly: spec.can_review_monthly } : role;
}

function isStateOfficeReviewWrite(method, pathname, roleKey = "") {
  if (method === "PATCH" && /\/api\/state-office\/.+\/(?:reports|office-profiles)\/[^/]+\/status$/.test(pathname)) {
    return true;
  }
  // Enrolment Drive endorse / return / deadline — State Coordinators only.
  if (
    method === "POST"
    && /\/api\/state-office\/enrolment-drives\/batches\/[^/]+\/(?:transition|deadline)$/.test(pathname)
  ) {
    return /state.*coordinator/.test(String(roleKey));
  }
  return false;
}

function canWriteDocumentRequest(user, method, originalUrl = "") {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  if (user?.role === "admin") return true;
  const spec = DOCUMENT_USER_PROFILES.find((item) => item.role === user?.role);
  if (!spec) return true;
  const pathname = originalUrl.split("?")[0];
  if (/^\/api\/notifications(?:\/|$)/.test(pathname)) return true;
  const role = user.role_config || spec;
  const roleKey = String(user?.role || "");

  if (spec.annualOnly) {
    if (/^\/api\/(?:annual-reports|reports|state-office\/challenges)(?:\/|$)/.test(pathname)) return true;
    if (role.can_review_monthly && isStateOfficeReviewWrite(method, pathname, roleKey)) return true;
    // Legacy annual-only State Coordinators may still endorse Enrolment Drives.
    if (/state.*coordinator/.test(roleKey) && isStateOfficeReviewWrite(method, pathname, roleKey)) return true;
    return false;
  }

  // Create-capable roles may mutate forms; review-only roles may only endorse / return.
  if (role.can_create_monthly) return true;
  if (role.can_review_monthly) {
    if (isStateOfficeReviewWrite(method, pathname, roleKey)) return true;
    if (/^\/api\/(?:annual-reports|reports|state-office\/challenges)(?:\/|$)/.test(pathname)) return true;
    return false;
  }
  // State Coordinator endorse path when role_config is missing / stale.
  if (/state.*coordinator/.test(roleKey) && isStateOfficeReviewWrite(method, pathname, roleKey)) return true;
  return false;
}

module.exports = { DOCUMENT_USER_PROFILES, documentRoleOverrides, canWriteDocumentRequest };
