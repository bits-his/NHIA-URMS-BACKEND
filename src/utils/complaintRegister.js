const SLA_TARGETS = {
  Top:    { acknowledge: 1, investigate: 1, escalate: 3, resolve: 5 },
  High:   { acknowledge: 1, investigate: 2, escalate: 7, resolve: 10 },
  Medium: { acknowledge: 2, investigate: 3, escalate: 14, resolve: 20 },
};

function daysBetween(start, end) {
  if (!start || !end) return null;
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function computeComplaintMetrics(body) {
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

function pickComplaintFields(body) {
  const fields = [
    "complaint_number", "zone_id", "state_id", "reporting_month", "reporting_year", "entry_date",
    "complaint_type", "complaint_category", "category_code", "complaint_domain", "domain_code",
    "offence_reference",
    "priority_rating", "date_received", "transmission_route",
    "complainant_category", "complainant_id", "respondent_category", "respondent_id",
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
  SLA_TARGETS, computeComplaintMetrics, pickComplaintFields, enrichComplaintCodes, daysBetween,
};
