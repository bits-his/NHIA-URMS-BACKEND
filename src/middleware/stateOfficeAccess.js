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
  challenges: "Challenges & Recommendations",
  igr: "IGR",
  "sshia-financial": "SSHIA Financial Report",
  "expenditure-profile": "Expenditure Profile",
  "weekly-actionable": "Weekly Actionable",
  "contracted-services": "Contracted Services",
  dashboard: "SOC/Zones Dashboard",
};

const SOC_ONLY_FUNCTIONALITIES = new Set([
  "SOC/Zones Dashboard",
  "Weekly Actionable",
  "Contracted Services",
  "Operation Monitoring Visit",
  "Spot Check Visit",
]);

/** Legacy path — also allow these sections to search NHIA lists */
const ACCREDITED_PROVIDER_SECTIONS = [
  "Enrollee Complaints",
  "Accreditation / Reaccreditation",
  "Reconciliation Meetings",
  "Compliance Monitoring",
  "Monitoring Visits",
];

function parseAccess(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
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
  if (funcs.includes(title)) return true;
  if (title === "Monitoring Visits" && funcs.includes("Compliance Monitoring")) return true;
  return false;
}

function grantForFunctionality(access, requiredFunctionality) {
  const socEntry = findSocZonesEntry(access);
  const zonalEntry = findZonalEntry(access);

  if (SOC_ONLY_FUNCTIONALITIES.has(requiredFunctionality)) {
    return socEntry && hasFunctionality(socEntry, requiredFunctionality);
  }

  if (zonalEntry && hasFunctionality(zonalEntry, requiredFunctionality)) return true;
  // Legacy users may still have zonal funcs under SOC/Zones
  if (socEntry && hasFunctionality(socEntry, requiredFunctionality)) return true;
  return false;
}

/** Require access to a specific state office child section */
function requireStateOfficeSection(requiredFunctionality) {
  return (req, res, next) => {
    if (req.user?.role === "admin") return next();

    const access = parseAccess(req.user?.functionalities);
    if (grantForFunctionality(access, requiredFunctionality)) return next();

    return res.status(403).json({ success: false, message: "Access denied" });
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

module.exports = { requireStateOfficeRoute, requireStateOfficeSection, ROUTE_FUNCTIONALITY };
