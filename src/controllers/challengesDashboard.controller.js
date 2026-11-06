/**
 * Challenges & Support — role-based dashboard aggregation.
 * Challenge and Support measures are kept separate (deck rule: never sum them).
 */
const { Op } = require("sequelize");
const {
  Challenge,
  SupportRequest,
  RecordHistory,
} = require("../models/ChallengesSupport");
const { StateOffice, ZonalOffice } = require("../models");

const OPEN_SUPPORT = new Set(["submitted", "under review", "assigned", "in progress", "returned for clarification"]);
const FINAL_CHALLENGE = new Set(["resolved", "closed", "no further action required"]);
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

function resolveDashRole(user) {
  const r = normalizeRole(user?.role);
  if (r === "dg-ceo") return "dg";
  if (r === "sdo" || r === "admin" || r === "hq-department") return "sdo";
  if (r === "zonal-coordinator" || r === "zc" || r.endsWith("-zonal-coordinator") || r.includes("zonal")) return "zd";
  if (user?.state_code || r.includes("state")) return "state";
  return null;
}

function scopeWhere(user, dashRole, q) {
  const where = {};
  const reqZone = q.zonal_code || q.zone_id;
  const reqState = q.state_code || q.state_id;
  if (dashRole === "state" && user?.state_code) {
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

function periodRange(q) {
  const now = new Date();
  const year = Number(q.year) || now.getFullYear();
  if (q.month && q.month !== "all") {
    const m = Number(q.month);
    return { from: `${year}-${String(m).padStart(2, "0")}-01`, to: `${year}-${String(m).padStart(2, "0")}-31`, year, month: m, quarter: null };
  }
  if (q.quarter && q.quarter !== "all") {
    const qt = Number(q.quarter);
    const m1 = (qt - 1) * 3 + 1;
    return { from: `${year}-${String(m1).padStart(2, "0")}-01`, to: `${year}-${String(m1 + 2).padStart(2, "0")}-31`, year, month: null, quarter: qt };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31`, year, month: null, quarter: null };
}

const bump = (map, k, n = 1) => { if (k) map[k] = (map[k] || 0) + n; };
const topList = (map, limit = 12) =>
  Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

const dashboard = async (req, res, next) => {
  try {
    const dashRole = resolveDashRole(req.user);
    if (!dashRole) {
      return res.status(403).json({ success: false, message: "Dashboard access is limited to State Office, Zonal Coordinator, SDO and DG" });
    }
    const q = req.query || {};
    const geo = scopeWhere(req.user, dashRole, q);
    const period = periodRange(q);

    const chWhere = { ...geo, date_reported: { [Op.between]: [period.from, period.to] } };
    const suWhere = { ...geo, date_submitted: { [Op.between]: [period.from, period.to] } };
    if (q.challenge_status && q.challenge_status !== "all") chWhere.status = q.challenge_status;
    if (q.severity && q.severity !== "all") chWhere.severity = q.severity;
    if (q.category && q.category !== "all") chWhere.category_label = q.category;
    if (q.programme && q.programme !== "all") chWhere.programme = q.programme;
    if (q.support_status && q.support_status !== "all") suWhere.status = q.support_status;
    if (q.priority && q.priority !== "all") suWhere.priority = q.priority;
    if (q.support_category && q.support_category !== "all") suWhere.support_category = q.support_category;
    if (q.department && q.department !== "all") suWhere.nhia_department = q.department;

    const [challenges, support] = await Promise.all([
      Challenge.findAll({
        where: chWhere,
        attributes: ["challenge_id", "state_code", "zonal_code", "date_reported", "category_label", "specific_challenge", "severity", "impact", "status", "escalation_department", "programme"],
        raw: true,
      }),
      SupportRequest.findAll({
        where: suWhere,
        attributes: ["support_id", "challenge_id", "state_code", "zonal_code", "date_submitted", "action_required_from", "nhia_department", "support_category", "specific_support", "priority", "status", "required_by_date"],
        raw: true,
      }),
    ]);

    const [states, zones] = await Promise.all([
      StateOffice.findAll({ attributes: ["code", "description", "zonal_code"], raw: true }).catch(() => []),
      ZonalOffice.findAll({ attributes: ["zonal_code", "description"], raw: true }).catch(() => []),
    ]);
    const stateName = Object.fromEntries(states.map((s) => [s.code, s.description]));
    const zoneName = Object.fromEntries(zones.map((z) => [z.zonal_code, z.description]));

    // ── Challenge KPIs (record-based, slide 10) ────────────────────────────
    const chTotal = challenges.length;
    const criticalHigh = challenges.filter((c) => /critical|high/i.test(c.severity || "")).length;
    const escalated = challenges.filter((c) => String(c.status).toLowerCase() === "escalated").length;
    const finalCount = challenges.filter((c) => FINAL_CHALLENGE.has(String(c.status).toLowerCase())).length;
    const resolved = challenges.filter((c) => String(c.status).toLowerCase() === "resolved").length;

    // ── Support KPIs (request-based) ───────────────────────────────────────
    const suTotal = support.length;
    const openSupport = support.filter((s) => OPEN_SUPPORT.has(String(s.status).toLowerCase())).length;
    const linked = support.filter((s) => s.challenge_id).length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = support.filter((s) =>
      OPEN_SUPPORT.has(String(s.status).toLowerCase()) && s.required_by_date && s.required_by_date < today).length;

    // Average resolution time: submission → history status transition to Resolved.
    const resolvedIds = support.filter((s) => String(s.status).toLowerCase() === "resolved").map((s) => s.support_id);
    let avgResolutionDays = null;
    if (resolvedIds.length) {
      const transitions = await RecordHistory.findAll({
        where: { support_id: { [Op.in]: resolvedIds }, to_status: "Resolved" },
        attributes: ["support_id", "createdAt"],
        order: [["createdAt", "ASC"]],
        raw: true,
      });
      const firstResolved = {};
      for (const t of transitions) if (!firstResolved[t.support_id]) firstResolved[t.support_id] = t.createdAt;
      const days = resolvedIds
        .map((id) => {
          const sub = support.find((s) => s.support_id === id)?.date_submitted;
          const res = firstResolved[id];
          return sub && res ? (new Date(res) - new Date(sub)) / 86400000 : null;
        })
        .filter((d) => d != null && d >= 0);
      if (days.length) avgResolutionDays = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
    }

    // ── Breakdowns ─────────────────────────────────────────────────────────
    const byCategory = {}; const bySeverity = {}; const byChStatus = {};
    const byChState = {}; const byChZone = {};
    const bySuStatus = {}; const byOwner = {}; const byDepartment = {}; const bySuCategory = {};
    const stateAgg = {}; const zoneAgg = {};

    for (const c of challenges) {
      bump(byCategory, c.category_label || "Uncategorised");
      bump(bySeverity, c.severity || "Unspecified");
      bump(byChStatus, c.status || "Unspecified");
      bump(byChState, c.state_code || "—");
      bump(byChZone, c.zonal_code || "—");
      if (!stateAgg[c.state_code]) stateAgg[c.state_code] = { challenges: 0, critical_high: 0 };
      stateAgg[c.state_code].challenges += 1;
      if (/critical|high/i.test(c.severity || "")) stateAgg[c.state_code].critical_high += 1;
      if (!zoneAgg[c.zonal_code]) zoneAgg[c.zonal_code] = { challenges: 0, critical_high: 0 };
      zoneAgg[c.zonal_code].challenges += 1;
      if (/critical|high/i.test(c.severity || "")) zoneAgg[c.zonal_code].critical_high += 1;
    }
    for (const s of support) {
      bump(bySuStatus, s.status || "Unspecified");
      bump(byOwner, s.action_required_from || "Unspecified");
      bump(byDepartment, s.nhia_department || "Unspecified");
      bump(bySuCategory, s.support_category || "Uncategorised");
      if (stateAgg[s.state_code]) { stateAgg[s.state_code].support = (stateAgg[s.state_code].support || 0) + 1; }
      else stateAgg[s.state_code] = { challenges: 0, critical_high: 0, support: 1 };
    }

    // ── Priority queue (slide 9) — real scoped records ─────────────────────
    const queueRows = [
      ...challenges.map((c) => ({
        kind: "Challenge",
        reference: c.challenge_id,
        title: c.specific_challenge || c.category_label,
        state: stateName[c.state_code] || c.state_code,
        owner: c.escalation_department || "—",
        status: c.status,
        priority: c.severity || "—",
        required_by: null,
        sort: SEV_ORDER[String(c.severity || "").toLowerCase()] ?? 9,
      })),
      ...support.map((s) => ({
        kind: "Support",
        reference: s.support_id,
        title: s.specific_support || s.support_category,
        state: stateName[s.state_code] || s.state_code,
        owner: s.nhia_department || s.action_required_from,
        status: s.status,
        priority: s.priority || "—",
        required_by: s.required_by_date,
        overdue: OPEN_SUPPORT.has(String(s.status).toLowerCase()) && s.required_by_date && s.required_by_date < today,
        sort: SEV_ORDER[String(s.priority || "").toLowerCase()] ?? 9,
      })),
    ].sort((a, b) => a.sort - b.sort || String(a.required_by || "9999").localeCompare(String(b.required_by || "9999"))).slice(0, 15);

    res.json({
      success: true,
      data: {
        role: dashRole,
        period: { ...period, label: period.month ? `${period.year}-${String(period.month).padStart(2, "0")}` : period.quarter ? `Q${period.quarter} ${period.year}` : `${period.year}` },
        scope: { zonal_code: geo.zonal_code || null, state_code: geo.state_code || null },
        challenge_kpis: {
          reported: chTotal,
          critical_high: criticalHigh,
          resolution_rate: pct(resolved, finalCount || chTotal),
          escalation_rate: pct(escalated, chTotal),
        },
        support_kpis: {
          requests: suTotal,
          open: openSupport,
          unresolved: openSupport,
          overdue,
          avg_resolution_days: avgResolutionDays,
          linked_share: pct(linked, suTotal),
          standalone: suTotal - linked,
        },
        challenges_by_category: topList(byCategory),
        challenges_by_severity: topList(bySeverity, 6),
        challenges_by_status: topList(byChStatus, 8),
        challenges_by_state: Object.entries(stateAgg)
          .map(([code, v]) => ({ state_code: code, state_name: stateName[code] || code, ...v }))
          .sort((a, b) => (b.challenges + (b.support || 0)) - (a.challenges + (a.support || 0))),
        challenges_by_zone: Object.entries(zoneAgg)
          .map(([code, v]) => ({ zonal_code: code, zone_name: zoneName[code] || code, ...v }))
          .sort((a, b) => b.challenges - a.challenges),
        support_by_status: topList(bySuStatus, 8),
        support_by_owner: topList(byOwner, 8),
        support_by_department: topList(byDepartment, 10),
        support_by_category: topList(bySuCategory, 10),
        queue: queueRows,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { dashboard };
