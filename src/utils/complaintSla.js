const ComplaintSlaRule = require("../models/ComplaintSlaRule");

const CLOSED_STATUSES = new Set([
  "Resolved", "Closed", "Referred to Appropriate Authority", "Complaint Withdrawn",
]);

const FALLBACK_RULES = {
  Top: { priority: "Top", acknowledge_days: 1, investigation_commence_days: 1, escalate_after_days: 3, target_resolution_days: 5 },
  High: { priority: "High", acknowledge_days: 1, investigation_commence_days: 2, escalate_after_days: 7, target_resolution_days: 10 },
  Medium: { priority: "Medium", acknowledge_days: 2, investigation_commence_days: 3, escalate_after_days: 14, target_resolution_days: 20 },
};

let rulesCache = null;
let rulesCacheAt = 0;
const CACHE_MS = 60_000;

function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

/** Working days elapsed after date_received (exclusive of receipt day). */
function workingDaysSinceReceived(received, asOf = new Date()) {
  const start = parseDateOnly(received);
  const end = parseDateOnly(asOf instanceof Date ? formatDateOnly(asOf) : asOf);
  if (!start || !end || end <= start) return 0;

  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  const d1 = parseDateOnly(start);
  const d2 = parseDateOnly(end);
  if (!d1 || !d2) return null;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function isComplaintClosed(c) {
  if (!c) return false;
  if (c.date_closed || c.resolution_date) return true;
  return CLOSED_STATUSES.has(c.status);
}

function isAcknowledged(c) {
  if (!c) return false;
  if (c.status && c.status !== "New/Acknowledged") return true;
  const actions = String(c.actions_taken || "");
  return actions.includes("Complaint acknowledged");
}

function hasInvestigationCommenced(c) {
  if (!c) return false;
  if (c.investigation_start_date) return true;
  if ([
    "Under Investigation", "Awaiting Information", "Awaiting Respondent Action",
    "Escalated", "Resolved", "Closed", "Referred to Appropriate Authority",
  ].includes(c.status)) return true;
  const actions = String(c.actions_taken || "");
  return actions.includes("Investigation commenced");
}

function isEscalated(c) {
  if (!c) return false;
  if (c.escalated === true || c.escalated === 1) return true;
  return c.status === "Escalated";
}

async function loadComplaintSlaRules(force = false) {
  const now = Date.now();
  if (!force && rulesCache && now - rulesCacheAt < CACHE_MS) return rulesCache;

  try {
    const rows = await ComplaintSlaRule.findAll({
      where: { is_active: true },
      order: [["priority", "ASC"]],
    });
    if (rows.length) {
      rulesCache = Object.fromEntries(rows.map((r) => [r.priority, r.get({ plain: true })]));
      rulesCacheAt = now;
      return rulesCache;
    }
  } catch {
    // table may not exist yet — use fallback
  }

  rulesCache = { ...FALLBACK_RULES };
  rulesCacheAt = now;
  return rulesCache;
}

function getRuleForPriority(rulesMap, priority) {
  if (!priority) return null;
  return rulesMap[priority] ?? FALLBACK_RULES[priority] ?? null;
}

function computeComplaintSla(complaint, rulesMap, asOf = new Date()) {
  const received = complaint.date_received || complaint.complaint_date;
  const rule = getRuleForPriority(rulesMap, complaint.priority_rating);
  const working_days_elapsed = workingDaysSinceReceived(received, asOf);
  const closed = isComplaintClosed(complaint);
  const acknowledged = isAcknowledged(complaint);
  const investigation_commenced = hasInvestigationCommenced(complaint);
  const escalated = isEscalated(complaint);

  const flags = [];
  let color = "white";
  let message = null;

  if (!rule) {
    return {
      color,
      message: "No SLA rule for priority",
      working_days_elapsed,
      flags,
      acknowledged,
      investigation_commenced,
      escalated,
      closed,
      rule: null,
    };
  }

  const resolution_days = daysBetween(received, complaint.date_closed || complaint.resolution_date);
  const resolution_within_sla = resolution_days != null
    ? resolution_days <= rule.target_resolution_days
    : null;

  if (!closed && working_days_elapsed > rule.target_resolution_days) {
    flags.push({
      code: "resolution_overdue",
      label: "Resolution target exceeded — complaint not closed",
    });
  }

  if (closed) {
    if (resolution_within_sla === false) {
      flags.push({ code: "resolution_missed", label: "Closed outside target resolution SLA" });
    }
    return {
      color: "white",
      message: null,
      working_days_elapsed,
      flags,
      acknowledged,
      investigation_commenced,
      escalated,
      closed,
      rule,
      resolution_days,
      resolution_within_sla,
    };
  }

  if (working_days_elapsed > rule.escalate_after_days && !escalated) {
    color = "red";
    message = "Escalation overdue";
    flags.push({ code: "escalation_overdue", label: "Not escalated within SLA" });
  } else if (working_days_elapsed > rule.investigation_commence_days && !investigation_commenced) {
    color = "amber";
    message = "Investigation did not commence";
    flags.push({ code: "investigation_not_commenced", label: "Investigation did not commence" });
  } else if (working_days_elapsed > rule.investigation_commence_days && investigation_commenced) {
    color = "yellow";
    message = "Investigation in progress";
  } else if (working_days_elapsed > rule.acknowledge_days && !acknowledged) {
    color = "yellow";
    message = "Not acknowledged within SLA";
    flags.push({ code: "not_acknowledged", label: "Not acknowledged within SLA" });
  }

  return {
    color,
    message,
    working_days_elapsed,
    flags,
    acknowledged,
    investigation_commenced,
    escalated,
    closed,
    rule,
    resolution_days,
    resolution_within_sla,
  };
}

function formatRuleForClient(rule) {
  if (!rule) return null;
  const wd = (n) => `Within ${n} working day${n === 1 ? "" : "s"}`;
  return {
    priority: rule.priority,
    acknowledge_days: rule.acknowledge_days,
    investigation_commence_days: rule.investigation_commence_days,
    escalate_after_days: rule.escalate_after_days,
    target_resolution_days: rule.target_resolution_days,
    acknowledge: wd(rule.acknowledge_days),
    investigate: wd(rule.investigation_commence_days),
    escalate: `${rule.escalate_after_days} working days`,
    resolve: `${rule.target_resolution_days} working days`,
  };
}

async function listComplaintSlaRulesFormatted() {
  const map = await loadComplaintSlaRules();
  return ["Top", "High", "Medium"]
    .map((p) => formatRuleForClient(map[p]))
    .filter(Boolean);
}

async function enrichComplaintWithSla(complaint, rulesMap) {
  const plain = complaint?.toJSON ? complaint.toJSON() : { ...complaint };
  const sla = computeComplaintSla(plain, rulesMap);
  return {
    ...plain,
    sla,
    resolution_within_sla: sla.resolution_within_sla ?? plain.resolution_within_sla ?? null,
    resolution_days: sla.resolution_days ?? plain.resolution_days ?? null,
  };
}

module.exports = {
  loadComplaintSlaRules,
  computeComplaintSla,
  enrichComplaintWithSla,
  listComplaintSlaRulesFormatted,
  workingDaysSinceReceived,
  daysBetween,
  isComplaintClosed,
  isAcknowledged,
  hasInvestigationCommenced,
  isEscalated,
  getRuleForPriority,
  FALLBACK_RULES,
};
