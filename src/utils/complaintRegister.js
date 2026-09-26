const { Op } = require("sequelize");
const {
  getRuleForPriority,
  loadComplaintSlaRules,
  daysBetween,
  isComplaintClosed,
} = require("./complaintSla");

const SLA_TARGETS = {
  Top:    { acknowledge: 1, investigate: 1, escalate: 3, resolve: 5 },
  High:   { acknowledge: 1, investigate: 2, escalate: 7, resolve: 10 },
  Medium: { acknowledge: 2, investigate: 3, escalate: 14, resolve: 20 },
};

async function computeComplaintMetrics(body) {
  const date_received = body.date_received || body.complaint_date || null;
  const date_closed = body.date_closed || body.resolution_date || null;
  const resolution_days = daysBetween(date_received, date_closed);
  const rulesMap = await loadComplaintSlaRules();
  const rule = getRuleForPriority(rulesMap, body.priority_rating);
  const resolution_within_sla = resolution_days != null && rule
    ? resolution_days <= rule.target_resolution_days
    : null;

  return {
    date_received,
    date_closed,
    resolution_days,
    resolution_within_sla,
    officer_assigned: body.officer_assigned || body.assigned_officer || null,
    complaint_date: date_received || body.complaint_date,
    resolution_date: date_closed,
    assigned_officer: body.officer_assigned || body.assigned_officer || null,
  };
}

function computeComplaintMetricsSync(body) {
  const date_received = body.date_received || body.complaint_date || null;
  const date_closed = body.date_closed || body.resolution_date || null;
  const resolution_days = daysBetween(date_received, date_closed);
  const sla = SLA_TARGETS[body.priority_rating];
  const resolution_within_sla = resolution_days != null && sla
    ? resolution_days <= sla.resolve
    : null;

  return {
    date_received,
    date_closed,
    resolution_days,
    resolution_within_sla,
    officer_assigned: body.officer_assigned || body.assigned_officer || null,
    complaint_date: date_received || body.complaint_date,
    resolution_date: date_closed,
    assigned_officer: body.officer_assigned || body.assigned_officer || null,
  };
}

function domainCodeFromDomain(domain) {
  const map = {
    Financial: "FIN",
    Operational: "OPS",
    Relationship: "REL",
    "Service Delivery": "SRV",
  };
  return map[domain] ?? (domain ? domain.slice(0, 3).toUpperCase() : null);
}

function categoryCodeFallback(type, category) {
  if (!type || !category) return null;
  const prefix = String(type).toUpperCase().slice(0, 3);
  const cat = String(category).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return `${prefix}-${cat}-001`;
}

function enrichComplaintCodes(body) {
  const out = {};
  if (!body.domain_code && body.complaint_domain) {
    out.domain_code = domainCodeFromDomain(body.complaint_domain);
  }
  if (!body.category_code && body.complaint_type && body.complaint_category) {
    out.category_code = categoryCodeFallback(body.complaint_type, body.complaint_category);
  }
  return out;
}

/** Match complaints assigned or escalated/forwarded to the logged-in user. */
function buildAssigneeWhere(user, Op) {
  if (!user?.name && !user?.staff_id) return null;
  const clauses = [];
  if (user.name) {
    const n = String(user.name).trim();
    if (n) {
      clauses.push(
        { officer_assigned: n },
        { assigned_officer: n },
        { escalated_to: n },
        { officer_assigned: { [Op.like]: `${n}%` } },
        { assigned_officer: { [Op.like]: `${n}%` } },
        { escalated_to: { [Op.like]: `${n}%` } },
      );
    }
  }
  if (user.staff_id) {
    const s = String(user.staff_id).trim();
    if (s) {
      clauses.push(
        { officer_assigned: { [Op.like]: `%(${s})%` } },
        { assigned_officer: { [Op.like]: `%(${s})%` } },
        { escalated_to: { [Op.like]: `%(${s})%` } },
        { officer_assigned: { [Op.like]: `%${s}%` } },
        { assigned_officer: { [Op.like]: `%${s}%` } },
        { escalated_to: { [Op.like]: `%${s}%` } },
      );
    }
  }
  return clauses.length ? { [Op.or]: clauses } : null;
}

/** Match complaints created by the logged-in user. */
function buildCreatorWhere(user, Op) {
  if (!user?.name && !user?.staff_id) return null;
  const clauses = [];
  if (user.name) {
    const n = String(user.name).trim();
    if (n) {
      clauses.push(
        { created_by: n },
        { created_by: { [Op.like]: `${n}%` } },
      );
    }
  }
  if (user.staff_id) {
    const s = String(user.staff_id).trim();
    if (s) {
      clauses.push(
        { created_by_staff_id: s },
        { created_by: { [Op.like]: `%(${s})%` } },
      );
    }
  }
  return clauses.length ? { [Op.or]: clauses } : null;
}

function isStateCoordinatorRole(role) {
  const r = String(role || "");
  return r === "state-coordinator" || r.endsWith("-state-coordinator");
}

function isReportingOfficerRole(role) {
  const r = String(role || "");
  return r === "reporting-officer" || r.endsWith("-reporting-officer");
}

/** Combine assignee + creator OR clauses for inbox/mine scope. */
function buildCreatedOrAssignedWhere(user, Op) {
  const parts = [];
  const assignee = buildAssigneeWhere(user, Op);
  const creator = buildCreatorWhere(user, Op);
  if (assignee?.[Op.or]) parts.push(...assignee[Op.or]);
  else if (assignee) parts.push(assignee);
  if (creator?.[Op.or]) parts.push(...creator[Op.or]);
  else if (creator) parts.push(creator);
  return parts.length ? { [Op.or]: parts } : null;
}

function pickComplaintFields(body) {
  const fields = [
    "complaint_number", "zone_id", "state_id", "reporting_month", "reporting_year", "entry_date",
    "complaint_type", "complaint_against", "complaint_category", "category_code", "complaint_domain", "domain_code",
    "offence_reference",
    "priority_rating", "date_received", "transmission_route",
    "complainant_category", "complainant_id", "complainant_name", "complainant_organization",
    "complainant_phone", "complainant_nhis_id",
    "complainant_hmo_id", "complainant_hcf_id",
    "respondent_category", "respondent_id", "respondent_name", "respondent_organization",
    "respondent_phone", "respondent_nhis_id",
    "respondent_hmo_id", "respondent_hcf_id",
    "officer_assigned", "investigation_start_date", "status", "actions_taken", "actions_details",
    "escalated", "escalation_level", "escalation_date", "escalated_to",
    "date_closed", "outcome", "remarks",
    "facility_name", "description",
  ];
  const out = {};
  for (const k of fields) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

module.exports = {
  SLA_TARGETS,
  computeComplaintMetrics,
  computeComplaintMetricsSync,
  buildAssigneeWhere,
  buildCreatorWhere,
  buildCreatedOrAssignedWhere,
  isStateCoordinatorRole,
  isReportingOfficerRole,
  pickComplaintFields,
  enrichComplaintCodes,
  daysBetween,
};
