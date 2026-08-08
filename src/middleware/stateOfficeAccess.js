const SOC_ZONES_MODULE = "SOC/Zones";
const LEGACY_MODULE = "State Offices";

/** First URL segment under /api/state-office → privilege child title */
const ROUTE_FUNCTIONALITY = {
  enrolment: "Enrolment",
  migration: "Migration / Update Requests",
  cemonc: "CEmONC & FFP Beneficiaries",
  complaints: "Complaints & Compliance Monitoring",
  "enrollee-complaints": "Enrollee Complaints",
  "compliance-visits": "Compliance Monitoring",
  "reconciliation-meetings": "Reconciliation Meetings",
  accreditation: "Accreditation / Reaccreditation",
  stakeholder: "Stakeholder Engagement",
  "hmo-selection": "HMO Selection Process",
  challenges: "Challenges & Recommendations",
  igr: "IGR",
  "sshia-financial": "SSHIA Financial Report",
  "expenditure-profile": "Expenditure Profile",
};

/** Legacy path — also allow these SOC/Zones sections to search NHIA lists */
const ACCREDITED_PROVIDER_SECTIONS = [
  "Enrollee Complaints",
  "Accreditation / Reaccreditation",
  "Reconciliation Meetings",
  "Compliance Monitoring",
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
    (e) => e?.access_to === SOC_ZONES_MODULE || e?.access_to === LEGACY_MODULE
  );
}

function hasFunctionality(entry, title) {
  const funcs = Array.isArray(entry?.functionalities) ? entry.functionalities : [];
  return funcs.includes(title);
}

/** Require access to a specific SOC/Zones child section */
function requireStateOfficeSection(requiredFunctionality) {
  return (req, res, next) => {
    if (req.user?.role === "admin") return next();

    const access = parseAccess(req.user?.functionalities);
    const entry = findSocZonesEntry(access);
    if (!entry || !hasFunctionality(entry, requiredFunctionality)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return next();
  };
}

/** Derive required section from the first path segment (e.g. /enrolment/reports → Enrolment) */
function requireStateOfficeRoute(req, res, next) {
  const segment = req.path.split("/").filter(Boolean)[0];

  if (segment === "accredited-providers" && req.method === "GET") {
    if (req.user?.role === "admin") return next();
    const access = parseAccess(req.user?.functionalities);
    const entry = findSocZonesEntry(access);
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
