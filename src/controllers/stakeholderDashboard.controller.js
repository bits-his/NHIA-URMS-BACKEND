/**
 * Stakeholder Engagement — role-based dashboard aggregation.
 * One activity = one stakeholder_reports row; multi-selects are pipe-delimited
 * (distinct records counted per programme / stakeholder / outcome, per workbook rule).
 */
const { Op } = require("sequelize");
const {
  StakeholderReport,
  StakeholderOutcome,
  StateOffice,
  ZonalOffice,
} = require("../models");
const { listDocuments } = require("../utils/formDocuments");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AWAITING = new Set(["awaiting_review", "submitted"]);
const FOLLOWUP_DONE = new Set(["completed", "closed", "done", "resolved", "no further action", "no further action required"]);
const ESCALATION_RE = /escalat|urgent|critical|high/i;
const PARTNERSHIP_RE = /partner|mou|collaborat|alliance/i;
const ISSUE_RE = /issue|barrier|implementation|bottleneck|resolved|resolution/i;

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

function resolveDashRole(user) {
  const r = normalizeRole(user?.role);
  if (r === "dg-ceo") return "dg";
  if (r === "sdo" || r === "admin" || r === "hq-department") return "sdo";
  if (r === "zonal-coordinator" || r === "zc" || r.endsWith("-zonal-coordinator")) return "zd";
  if (user?.state_code || r === "state-coordinator" || r.endsWith("-state-coordinator") || r.includes("state")) return "sc";
  return null;
}

function pipeSplit(v) {
  if (!v) return [];
  return String(v).split("|").map((s) => s.trim()).filter(Boolean);
}

function scopeWhere(user, dashRole, query) {
  const where = {};
  const reqZone = query.zonal_code || query.zone_id;
  const reqState = query.state_code || query.state_id;

  if (dashRole === "sc" && user?.state_code) {
    if (reqState && reqState !== "all" && String(reqState) !== String(user.state_code)) {
      throw Object.assign(new Error("Access denied"), { status: 403 });
    }
    where.state_code = String(user.state_code);
    if (user.zonal_code) where.zonal_code = String(user.zonal_code);
    return where;
  }
  if (dashRole === "zd" && user?.zonal_code) {
    if (reqZone && reqZone !== "all" && String(reqZone) !== String(user.zonal_code)) {
      throw Object.assign(new Error("Access denied"), { status: 403 });
    }
    where.zonal_code = String(user.zonal_code);
    if (reqState && reqState !== "all") where.state_code = String(reqState);
    return where;
  }
  if (reqZone && reqZone !== "all") where.zonal_code = String(reqZone);
  if (reqState && reqState !== "all") where.state_code = String(reqState);
  return where;
}

function periodWhere(query) {
  const now = new Date();
  const year = Number(query.year) || now.getFullYear();
  const month = query.month;
  const quarter = query.quarter;
  const where = { reporting_year: year };
  if (month && month !== "all") {
    where.reporting_month = Number(month);
  } else if (quarter && quarter !== "all") {
    const q = Number(quarter);
    where.reporting_month = { [Op.between]: [(q - 1) * 3 + 1, q * 3] };
  }
  return { where, year, month: month && month !== "all" ? Number(month) : null, quarter: quarter && quarter !== "all" ? Number(quarter) : null };
}

const isYes = (v) => /^y(es)?$/i.test(String(v || "").trim());
const isCompleted = (v) => /completed|conducted|done/i.test(String(v || "").trim());
const followUpOutstanding = (r) =>
  isYes(r.follow_up_required) && !FOLLOWUP_DONE.has(String(r.follow_up_status || "").trim().toLowerCase());

const dashboard = async (req, res, next) => {
  try {
    const dashRole = resolveDashRole(req.user);
    if (!dashRole) {
      return res.status(403).json({ success: false, message: "Dashboard access is limited to State Coordinator, Zonal Director, SDO and DG" });
    }

    const geo = scopeWhere(req.user, dashRole, req.query || {});
    const { where: period, year, month, quarter } = periodWhere(req.query || {});
    const where = { ...geo, ...period };
    if (req.query.status && req.query.status !== "all") where.status = req.query.status;
    if (req.query.category && req.query.category !== "all") where.engagement_category = req.query.category;
    if (req.query.follow_up_status && req.query.follow_up_status !== "all") where.follow_up_status = req.query.follow_up_status;

    const rows = await StakeholderReport.findAll({
      where,
      attributes: [
        "reference_id", "zonal_code", "state_code", "status", "activity_status",
        "engagement_category", "stakeholder_categories", "stakeholder_names",
        "programs_supported", "supporting_evidence_types",
        "follow_up_required", "follow_up_status", "follow_up_date",
        "follow_up_action", "follow_up_responsible", "follow_up_priority",
        "reporting_year", "reporting_month",
      ],
      raw: true,
    });

    // Programme filter applies post-fetch (pipe-delimited multi-select).
    const programme = req.query.programme && req.query.programme !== "all" ? String(req.query.programme) : null;
    const records = programme
      ? rows.filter((r) => pipeSplit(r.programs_supported).includes(programme))
      : rows;

    const refIds = records.map((r) => r.reference_id);
    const outcomes = refIds.length
      ? await StakeholderOutcome.findAll({ where: { report_reference_id: { [Op.in]: refIds } }, raw: true })
      : [];

    const [states, zones] = await Promise.all([
      StateOffice.findAll({ attributes: ["code", "description", "zonal_code"], raw: true }).catch(() => []),
      ZonalOffice.findAll({ attributes: ["zonal_code", "description"], raw: true }).catch(() => []),
    ]);
    const stateName = Object.fromEntries(states.map((s) => [s.code, s.description]));
    const zoneName = Object.fromEntries(zones.map((z) => [z.zonal_code, z.description]));
    const scopeStates = states.filter((s) => !geo.zonal_code || s.zonal_code === geo.zonal_code)
      .filter((s) => !geo.state_code || s.code === geo.state_code);
    const scopeZones = geo.zonal_code ? zones.filter((z) => z.zonal_code === geo.zonal_code) : zones;

    const count = (rowsArr, key) => rowsArr.filter((r) => key(r)).length;
    const bump = (map, k, n = 1) => { if (k) map[k] = (map[k] || 0) + n; };
    const topList = (map, limit = 12) =>
      Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);

    const byCategory = {}; const byProgramme = {}; const byStakeholder = {};
    const byState = {}; const byZone = {}; const monthly = {};
    const outcomeCats = {}; const outcomeRefs = {};
    let partnerships = 0; let issuesAddressed = 0;

    for (const r of records) {
      bump(byCategory, r.engagement_category || "Uncategorised");
      bump(byState, r.state_code || "—");
      bump(byZone, r.zonal_code || "—");
      for (const p of new Set(pipeSplit(r.programs_supported))) bump(byProgramme, p);
      for (const s of new Set(pipeSplit(r.stakeholder_categories))) bump(byStakeholder, s);
      const mk = `${r.reporting_year}-${String(r.reporting_month).padStart(2, "0")}`;
      bump(monthly, mk);
    }
    for (const o of outcomes) {
      const cat = o.outcome_category || "Uncategorised";
      if (!outcomeRefs[cat]) outcomeRefs[cat] = new Set();
      outcomeRefs[cat].add(o.report_reference_id);
    }
    for (const [cat, refs] of Object.entries(outcomeRefs)) {
      outcomeCats[cat] = refs.size;
      if (PARTNERSHIP_RE.test(cat)) partnerships += refs.size;
      if (ISSUE_RE.test(cat)) issuesAddressed += refs.size;
    }

    const stateAgg = {};
    for (const r of records) {
      const code = r.state_code || "—";
      if (!stateAgg[code]) stateAgg[code] = { activities: 0, followups_outstanding: 0, completed: 0 };
      stateAgg[code].activities += 1;
      if (followUpOutstanding(r)) stateAgg[code].followups_outstanding += 1;
      if (isCompleted(r.activity_status)) stateAgg[code].completed += 1;
    }
    const statesReporting = Object.keys(stateAgg).filter((k) => k !== "—").length;
    const statesList = Object.entries(stateAgg)
      .map(([code, v]) => ({ state_code: code, state_name: stateName[code] || code, ...v }))
      .sort((a, b) => b.activities - a.activities);
    const statesNeedingSupport = scopeStates
      .filter((s) => !stateAgg[s.code] || stateAgg[s.code].activities === 0 || stateAgg[s.code].followups_outstanding >= 3)
      .map((s) => ({ state_code: s.code, state_name: s.description, reason: !stateAgg[s.code] ? "No activity recorded" : `${stateAgg[s.code].followups_outstanding} follow-ups outstanding` }));

    // Data quality — evidence docs require a lookup per record; cap at 300 rows.
    let missingEvidence = 0;
    const sample = records.slice(0, 300);
    for (const r of sample) {
      if (pipeSplit(r.supporting_evidence_types).length) continue;
      const docs = await listDocuments("stakeholder", r.reference_id).catch(() => []);
      if (!docs.length) missingEvidence += 1;
    }
    const incompleteFollowUp = count(records, (r) =>
      isYes(r.follow_up_required) && (!r.follow_up_status || !r.follow_up_action));
    const awaitingEndorsement = count(records, (r) => AWAITING.has(String(r.status)));

    // Trend — months within the selected period.
    const monthsInScope = month ? [month]
      : quarter ? [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, quarter * 3]
      : Array.from({ length: 12 }, (_, i) => i + 1);
    const trend = monthsInScope.map((m) => ({
      month: m,
      label: MONTHS[m - 1],
      activities: monthly[`${year}-${String(m).padStart(2, "0")}`] || 0,
    }));

    const followUpsRequired = count(records, (r) => isYes(r.follow_up_required));
    const followUpsOutstanding = count(records, followUpOutstanding);
    const escalations = count(records, (r) => ESCALATION_RE.test(String(r.follow_up_priority || "")));

    const queue = [];
    if (dashRole === "sc") {
      if (awaitingEndorsement) queue.push({ issue: "Reports awaiting endorsement", count: awaitingEndorsement, action: "Review completeness and endorse or return with remarks." });
      if (followUpsOutstanding) queue.push({ issue: "Outstanding follow-ups", count: followUpsOutstanding, action: "Confirm next action, responsible officer and due date." });
      if (missingEvidence) queue.push({ issue: "Records missing supporting evidence", count: missingEvidence, action: "Attach minutes, attendance or other evidence to complete the record." });
      if (incompleteFollowUp) queue.push({ issue: "Incomplete follow-up details", count: incompleteFollowUp, action: "Fill in status, responsible officer and next action." });
    } else if (dashRole === "zd") {
      for (const s of statesNeedingSupport.slice(0, 5)) queue.push({ issue: `${s.state_name}: ${s.reason}`, count: null, action: "Contact State Coordinator and agree a submission/support plan." });
      const backlog = statesList.filter((s) => s.followups_outstanding >= 3);
      for (const s of backlog.slice(0, 5)) queue.push({ issue: `${s.state_name}: follow-up backlog`, count: s.followups_outstanding, action: "Identify shared barriers and coordinate technical support." });
    } else if (dashRole === "sdo") {
      const zoneAgg = Object.entries(byZone).map(([z, v]) => ({ z, v }));
      const maxZone = Math.max(1, ...zoneAgg.map((x) => x.v));
      for (const x of zoneAgg.filter((x) => x.v <= maxZone * 0.5).slice(0, 5)) {
        queue.push({ issue: `${zoneName[x.z] || x.z}: low engagement vs other zones`, count: x.v, action: "Engage zone, validate context and agree corrective support." });
      }
      if (escalations) queue.push({ issue: "Escalations flagged on follow-ups", count: escalations, action: "Review flagged items and escalate cross-departmental issues with evidence." });
      const nonReporting = scopeStates.filter((s) => !stateAgg[s.code]).length;
      if (nonReporting) queue.push({ issue: "States with no activity in period", count: nonReporting, action: "Confirm reporting coverage and agree a catch-up plan." });
    } else {
      const gaps = scopeZones.filter((z) => !byZone[z.zonal_code]);
      for (const z of gaps.slice(0, 5)) queue.push({ issue: `${z.description}: no engagement recorded`, count: null, action: "Direct targeted engagement and request a time-bound action plan." });
      if (followUpsOutstanding) queue.push({ issue: "Strategic commitments requiring follow-through", count: followUpsOutstanding, action: "Assign a responsible department and review progress at management meetings." });
    }

    res.json({
      success: true,
      data: {
        role: dashRole,
        period: { year, month, quarter, label: month ? `${MONTHS[month - 1]} ${year}` : quarter ? `Q${quarter} ${year}` : `${year}` },
        scope: { zonal_code: geo.zonal_code || null, state_code: geo.state_code || null },
        summary: {
          activities: records.length,
          completed: count(records, (r) => isCompleted(r.activity_status)),
          follow_ups_required: followUpsRequired,
          follow_ups_outstanding: followUpsOutstanding,
          awaiting_endorsement: awaitingEndorsement,
          escalations,
          states_reporting: statesReporting,
          states_total: scopeStates.length,
          zones_reporting: Object.keys(byZone).filter((k) => k !== "—").length,
          zones_total: scopeZones.length,
          states_needing_support: statesNeedingSupport.length,
          stakeholder_groups: Object.keys(byStakeholder).length,
          outcome_categories: Object.keys(outcomeCats).length,
          partnerships,
          issues_addressed: issuesAddressed,
          missing_evidence: missingEvidence,
          incomplete_follow_up: incompleteFollowUp,
        },
        by_category: topList(byCategory),
        by_programme: topList(byProgramme),
        by_stakeholder: topList(byStakeholder),
        by_state: statesList,
        by_zone: topList(byZone).map((x) => ({ ...x, name: zoneName[x.name] || x.name })),
        outcomes: topList(outcomeCats),
        trend,
        queue,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { dashboard };
