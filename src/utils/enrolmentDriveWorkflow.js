const { randomBytes } = require("crypto");

const PROGRAMMES = ["FSSHIP", "OPS", "BHCPF", "TISHIP", "GIFSHIP-G", "GIFSHIP-C", "GIFSHIP-R", "GIFSHIP-N", "CEmONC", "FFP", "CBSHIP", "NHIA-Roche Cancer Program"];
const AUDIENCES = ["State Executives", "Organized Labour", "Traditional Rulers", "Employers", "Desk Officers", "Students", "Private Company", "Market Association", "Artisan Group", "Religious Organisation", "Community Leaders", "Traditional Institution", "HCPs", "HMOs", "Healthcare Provider Association", "Civil Society", "NGOs", "General Public", "Corp Members", "Women", "Children", "Youth", "Existing Beneficiaries", "Informal Sector", "Others (specify)"];
const LOCATIONS = {
  Government: ["NHIA Office", "State Government Secretariat", "Ministry/Department/Agency Office", "Local Government Secretariat", "Government Institution", "Government Meeting Venue"],
  "Health Sector": ["Health Facility", "PHC", "Primary Healthcare Centre", "NHIA Programme Office", "Health Management Organisation Office", "Provider Organisation Office", "Healthcare Provider Association Office"],
  "Stakeholder Organisation": ["Stakeholder's Office", "Corporate Office", "NGO/CSO Office", "Development Partner Office", "Professional Association Office", "Trade/Business Association Office", "Union Office", "Cooperative Society Office"],
  "Community and Traditional": ["Traditional Ruler's Palace", "Community Centre", "Community Hall", "Community Meeting Venue", "Ward Meeting Centre", "Religious Centre", "Market"],
  Institutional: ["School", "Tertiary Institution", "Research Institution", "Training Institution", "Conference Centre", "Hotel/Meeting Venue", "Workplace"],
  Media: ["Radio Station", "Television Station", "Media House", "Press Centre"],
  Virtual: ["Online", "Telephone/Teleconference"],
};
const FUNDING = ["Zero-Cost (Statutory Mandate)", "Budgeted (Approved Release)"];
const STATUSES = ["Completed", "In Progress", "Not Conducted", "Not Applicable", "Deferred", "Cancelled"];
const EVIDENCE_TYPES = ["Attendance Register", "Photographs", "Minutes", "Official Letter", "Field Report", "Media Recording", "Other"];
const NATIONAL = new Set(["admin", "sdo", "dg-ceo", "hq-department"]);
const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const reference = (prefix) => `${prefix}-${new Date().getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;
const text = (value, max = 1000) => String(value ?? "").trim().slice(0, max);

function hasDriveAccess(user) {
  const grants = JSON.stringify(user?.functionalities || []).toLowerCase();
  return NATIONAL.has(user?.role) || grants.includes("enrolment drives") || grants.includes("enrolment-drive") || require("./enrolmentDriveTypes").ENROLMENT_DRIVE_TYPES.some((type) => grants.includes(type.title.toLowerCase()));
}

function isStateCoordinatorRole(role) {
  const r = String(role || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  return r === "state-coordinator" || r.endsWith("-state-coordinator");
}

function isZonalCoordinatorRole(role) {
  const r = String(role || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  return r === "zonal-coordinator" || r === "zc" || r.endsWith("-zonal-coordinator");
}

/** Dashboard actors from the Enrolment Drives design: SC, Zonal Director, SDO, DG (+ admin for support). */
function canAccessEnrolmentDriveDashboard(user) {
  const role = String(user?.role || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  const scope = user?.role_config?.report_scope;
  if (role === "admin" || role === "sdo" || role === "dg-ceo") return true;
  if (role === "state-coordinator") return true;
  if (isStateCoordinatorRole(role) && scope === "state" && user?.state_code) return true;
  if (isZonalCoordinatorRole(role) && scope !== "national" && user?.zonal_code) return true;
  return false;
}

function scopeWhere(user) {
  const role = user?.role || "";
  const reportScope = user?.role_config?.report_scope;

  if (NATIONAL.has(role)) return {};

  // HQ division roles may be named *-state-coordinator with national scope and no state.
  if (reportScope === "national" && !user?.state_code) return {};

  // Real state coordinators / state-scoped officers stay locked to their assigned state.
  if (reportScope === "state" || (isStateCoordinatorRole(role) && user?.state_code)) {
    if (!user?.state_code) throw fail("No state is assigned to your account", 403);
    return { state_code: user.state_code };
  }

  if (reportScope === "zonal" || /zonal/.test(role) || role === "zc") {
    if (!user?.zonal_code) throw fail("No zone is assigned to your account", 403);
    return { zonal_code: user.zonal_code };
  }

  if (reportScope === "national") return {};
  if (user?.state_code) return { state_code: user.state_code };
  if (user?.zonal_code) return { zonal_code: user.zonal_code };
  throw fail("No state or zone is assigned to your account", 403);
}

function assertScope(user, row) {
  const scope = scopeWhere(user);
  if (Object.entries(scope).some(([key, value]) => String(row[key]) !== String(value))) throw fail("Access denied", 403);
}

function integer(value, label, required = false) {
  if (value === "" || value == null) {
    if (required) throw fail(`${label} is required`);
    return null;
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295) throw fail(`${label} must be a non-negative whole number`);
  return n;
}

function activityValues(body, { complete = false, year, month } = {}) {
  const result = {};
  for (const [key, max] of Object.entries({ activity_category: 120, specific_activity: 255, location_category: 80, location_name: 150, exact_location: 500, activity_details: 10000, activity_status: 30, status_reason: 2000, remarks: 5000, evidence_type: 80, funding_option: 80, other_programme: 255, other_audience: 255 })) result[key] = text(body[key], max) || null;
  result.activity_date = body.activity_date || null;
  if (result.activity_date) {
    const date = new Date(`${result.activity_date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.activity_date) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== result.activity_date) throw fail("Enter a valid activity date");
    if (year && month && (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month))) throw fail("Activity date must fall within the reporting month");
  }
  if (result.location_category && !LOCATIONS[result.location_category]) throw fail("Select a valid location category");
  if (result.location_name && !LOCATIONS[result.location_category]?.includes(result.location_name)) throw fail("Select a location from the selected category");
  if (result.activity_status && !STATUSES.includes(result.activity_status)) throw fail("Select a valid activity status");
  if (result.funding_option && !FUNDING.includes(result.funding_option)) throw fail("Select a valid funding option");
  if (result.evidence_type && !EVIDENCE_TYPES.includes(result.evidence_type)) throw fail("Select a valid evidence type");
  for (const key of ["planned_target_audience", "target_audience_reached", "leads_generated"]) result[key] = integer(body[key], key.replaceAll("_", " "), complete);
  for (const key of ["activity_budget", "approved_amount"]) {
    const value = body[key];
    result[key] = result.funding_option === FUNDING[1] && value != null && value !== "" ? Number(value) : null;
    if (result[key] != null && (!Number.isFinite(result[key]) || result[key] < 0 || result[key] >= 1e13)) throw fail("Enter a valid funding amount");
    if (complete && result.funding_option === FUNDING[1] && result[key] == null) throw fail("Activity budget and approved amount are required for budgeted activities");
  }
  for (const [key, allowed] of [["programs_supported", PROGRAMMES], ["target_audience", AUDIENCES]]) {
    if (body[key] != null && !Array.isArray(body[key])) throw fail(`Invalid ${key}`);
    result[key] = [...new Set(body[key] || [])];
    if (result[key].some((value) => !allowed.includes(value))) throw fail(`Select valid ${key.replaceAll("_", " ")}`);
    if (complete && !result[key].length) throw fail(`Select ${key.replaceAll("_", " ")}`);
  }
  if (complete) {
    for (const key of ["activity_date", "activity_category", "specific_activity", "location_category", "location_name", "exact_location", "activity_status", "funding_option", "activity_details", "evidence_type"]) if (!result[key]) throw fail(`${key.replaceAll("_", " ")} is required`);
    if (["Not Conducted", "Deferred", "Cancelled"].includes(result.activity_status) && !result.status_reason) throw fail("Explain why the activity was not conducted, deferred or cancelled");
    if (/^others?/i.test(result.activity_category) && !result.specific_activity) throw fail("Specify the activity");
    if (result.target_audience.includes("Others (specify)") && !result.other_audience) throw fail("Specify the target audience");
  }
  return result;
}

function nextStatus(current, action, { review = false, create = false, sameOfficer = false } = {}) {
  if (action === "send_for_review" && create && ["draft", "returned"].includes(current)) return "awaiting_review";
  if (action === "return" && review && !sameOfficer && current === "awaiting_review") return "returned";
  if (action === "endorse" && review && !sameOfficer && current === "awaiting_review") return "endorsed";
  if (action === "final_submit" && create && current === "endorsed") return "submitted";
  throw fail("This action is not permitted for your role or the current report status", 403);
}

function totals(batches, activities, enrolments) {
  const counts = new Map();
  for (const record of enrolments) if (record.drive_reference_id && record.category === "enrolment") counts.set(record.drive_reference_id, (counts.get(record.drive_reference_id) || 0) + Number(record.enrolment_count || 0));
  return {
    planned: batches.reduce((sum, batch) => sum + Number(batch.planned_activities || 0), 0),
    recorded: activities.length,
    conducted: activities.filter((activity) => activity.activity_status === "Completed").length,
    reached: activities.reduce((sum, activity) => sum + Number(activity.target_audience_reached || 0), 0),
    leads: activities.reduce((sum, activity) => sum + Number(activity.leads_generated || 0), 0),
    enrolled: [...counts.values()].reduce((sum, count) => sum + count, 0),
    counts,
  };
}

module.exports = { PROGRAMMES, AUDIENCES, LOCATIONS, FUNDING, STATUSES, EVIDENCE_TYPES, NATIONAL, fail, reference, text, hasDriveAccess, canAccessEnrolmentDriveDashboard, isStateCoordinatorRole, isZonalCoordinatorRole, scopeWhere, assertScope, integer, activityValues, nextStatus, totals };
