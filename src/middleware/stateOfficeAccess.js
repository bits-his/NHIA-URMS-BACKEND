const SOC_ZONES_MODULE = "SOC/Zones";
const ZONAL_MODULE = "Zonal";
const LEGACY_MODULE = "State Offices";
const ZONAL_LEGACY = "Others";

/** First URL segment under /api/state-office → privilege child title */
const ROUTE_FUNCTIONALITY = {
  enrolment: "Enrolment",
  migration: "Migration / Update Requests",
  cemonc: "CEmONC & FFP Beneficiaries",
  complaints: "Complaints & Compliance Monitoring",
  "enrollee-complaints": "Enrollee Complaints",
  "compliance-visits": "Monitoring Visits",
  "reconciliation-meetings": "Reconciliation Meetings",
  accreditation: "Accreditation / Reaccreditation",
  stakeholder: "Stakeholder Engagement",
  "hmo-selection": "HMO Selection Process",
  "extra-dependant": "Additional / Extra Dependant",
  "hcf-change": "Change of HCF",
  challenges: "Challenges & Recommendations",
  igr: "IGR",
  "sshia-financial": "SSHIA Financial Report",
  "expenditure-profile": "Expenditure Profile",
  "weekly-actionable": "Weekly Actionable",
  "contracted-services": "Contracted Services",
  "enrollee-register": "Monthly Enrollee Register",
  "etmc-tmc-action-point": "ETMC/TMC Action-Point Register",
  dashboard: "SOC/Zones Dashboard",
  "office-profiles": "State/Zonal Office Profile",
  "focal-persons": "State/Zonal Focal Persons Register",
};

const SOC_ONLY_FUNCTIONALITIES = new Set([
  "SOC/Zones Dashboard",
  "State/Zonal Office Profile",
  "State/Zonal Focal Persons Register",
  "Weekly Actionable",
  "Contracted Services",
  "Monthly Enrollee Register",
  "ETMC/TMC Action-Point Register",
  "Operation Monitoring Visit",
  "Spot Check Visit",
]);

/** Canonical title → legacy names stored in older user.functionalities rows */
const FUNCTIONALITY_ALIASES = {
  "Migration / Update Requests": [
    "Migration",
    "Migration/Update Requests",
    "Migration & Update Requests",
  ],
  "CEmONC & FFP Beneficiaries": [
    "CEmONC",
    "CEmONC & FFP",
    "CEmONC and FFP Beneficiaries",
  ],
  "Monitoring Visits": [
    "Compliance Monitoring",
    "Enrollee Complaints",
    "Compliance Visits",
  ],
  "Accreditation / Reaccreditation": [
    "Accreditation",
    "Reaccreditation",
  ],
  "Stakeholder Engagement": ["Stakeholder"],
  "HMO Selection Process": ["HMO Selection", "HMO Selection Process"],
  "Additional / Extra Dependant": ["Extra Dependant", "Additional/Extra Dependent", "Additional / Extra Dependent"],
  "Change of HCF": ["Change of HCP", "Change of HCF/HCP", "Change of HCF"],
  "Challenges & Recommendations": ["Challenges"],
  "SSHIA Financial Report": ["SSHIA Financial", "SSHIA Financial Reports"],
  "Complaints & Compliance Monitoring": [
    "Complaints",
    "Compliance Monitoring",
  ],
  "Enrollee Complaints": ["Complaints Register", "Complaints"],
  "Reconciliation Meetings": ["Reconciliation"],
};

/** Legacy path — also allow these sections to search NHIA lists */
const ACCREDITED_PROVIDER_SECTIONS = [
  "Enrollee Complaints",
  "Accreditation / Reaccreditation",
  "Reconciliation Meetings",
  "Compliance Monitoring",
  "Monitoring Visits",
];

const STATE_OFFICE_ACCESS_MODULES = new Set([
  SOC_ZONES_MODULE,
  ZONAL_MODULE,
  LEGACY_MODULE,
  ZONAL_LEGACY,
]);

function parseAccess(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function acceptedFunctionalityNames(title) {
  return new Set([title, ...(FUNCTIONALITY_ALIASES[title] || [])]);
}

function findSocZonesEntry(access) {
  return access.find(
    (e) => e?.access_to === SOC_ZONES_MODULE || e?.access_to === LEGACY_MODULE,
  );
}

function findZonalEntry(access) {
  return access.find(
    (e) => e?.access_to === ZONAL_MODULE || e?.access_to === ZONAL_LEGACY,
  );
}

function hasFunctionality(entry, title) {
  const funcs = Array.isArray(entry?.functionalities) ? entry.functionalities : [];
  const accepted = acceptedFunctionalityNames(title);
  return funcs.some((f) => accepted.has(f));
}

function grantForFunctionality(access, requiredFunctionality) {
  if (SOC_ONLY_FUNCTIONALITIES.has(requiredFunctionality)) {
    const socEntry = findSocZonesEntry(access);
    return !!socEntry && hasFunctionality(socEntry, requiredFunctionality);
  }

  // Prefer Zonal / SOC entries, then any state-office-related module row
  const zonalEntry = findZonalEntry(access);
  if (zonalEntry && hasFunctionality(zonalEntry, requiredFunctionality)) return true;

  const socEntry = findSocZonesEntry(access);
  if (socEntry && hasFunctionality(socEntry, requiredFunctionality)) return true;

  for (const entry of access) {
    if (!entry?.access_to || !STATE_OFFICE_ACCESS_MODULES.has(entry.access_to)) continue;
    if (hasFunctionality(entry, requiredFunctionality)) return true;
  }

  return false;
}

/** Require access to a specific state office child section */
function requireStateOfficeSection(requiredFunctionality) {
  return (req, res, next) => {
    if (req.user?.role === "admin") return next();

    const access = parseAccess(req.user?.functionalities);
    if (grantForFunctionality(access, requiredFunctionality)) return next();

    return res.status(403).json({
      success: false,
      message: "Access denied",
      required: requiredFunctionality,
    });
  };
}

/** Derive required section from the first path segment (e.g. /enrolment/reports → Enrolment) */
function requireStateOfficeRoute(req, res, next) {
  const segment = req.path.split("/").filter(Boolean)[0];

  if (segment === "accredited-providers" && req.method === "GET") {
    if (req.user?.role === "admin") return next();
    const access = parseAccess(req.user?.functionalities);
    const socEntry = findSocZonesEntry(access);
    const zonalEntry = findZonalEntry(access);
    const entry = zonalEntry || socEntry;
    if (entry && ACCREDITED_PROVIDER_SECTIONS.some((title) => hasFunctionality(entry, title))) {
      return next();
    }
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const required = ROUTE_FUNCTIONALITY[segment];
  if (!required) return next();
  return requireStateOfficeSection(required)(req, res, next);
}

module.exports = {
  requireStateOfficeRoute,
  requireStateOfficeSection,
  ROUTE_FUNCTIONALITY,
  grantForFunctionality,
  hasFunctionality,
};
