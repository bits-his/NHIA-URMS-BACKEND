const { DEPARTMENTS, accessForDepartment, accessForUnit } = require("./orgCatalog");

const TIER = {
  officer: {
    suffix: "reporting-officer",
    labelSuffix: "Reporting Officer",
    prefixSuffix: "RO",
    report_scope: "state",
    can_create_monthly: true,
    can_review_monthly: false,
  },
  state: {
    suffix: "state-coordinator",
    labelSuffix: "State Coordinator",
    prefixSuffix: "SC",
    report_scope: "state",
    can_create_monthly: true,
    can_review_monthly: true,
  },
  zonal: {
    suffix: "zonal-coordinator",
    labelSuffix: "Zonal Coordinator",
    prefixSuffix: "ZC",
    report_scope: "zonal",
    can_create_monthly: false,
    can_review_monthly: true,
  },
};

function buildDepartmentRoles() {
  const roles = [];
  for (const dept of DEPARTMENTS) {
    const code = dept.department_code;
    const short = code.replace(/[^A-Z0-9]/g, "").slice(0, 5);
    for (const tier of Object.values(TIER)) {
      roles.push({
        key: `${code.toLowerCase()}-${tier.suffix}`,
        label: `${dept.name} ${tier.labelSuffix}`,
        staff_id_prefix: `${short}${tier.prefixSuffix}`.slice(0, 10),
        report_scope: tier.report_scope,
        can_create_monthly: tier.can_create_monthly,
        can_review_monthly: tier.can_review_monthly,
        is_system: true,
        department_code: code,
        description: dept.description,
      });
    }
  }
  return roles;
}

const DEPARTMENT_ROLES = buildDepartmentRoles();

function getDefaultAccess(roleKey, unitCode) {
  const row = DEPARTMENT_ROLES.find((r) => r.key === roleKey);
  if (!row) return null;
  if (unitCode) return accessForUnit(unitCode);
  return accessForDepartment(row.department_code);
}

function getDepartmentCodeForRole(roleKey) {
  return DEPARTMENT_ROLES.find((r) => r.key === roleKey)?.department_code || null;
}

module.exports = {
  DEPARTMENT_ROLES,
  getDefaultAccess,
  getDepartmentCodeForRole,
};
