/**
 * Beneficiary Management — role-based dashboard aggregation.
 * One row per register activity in beneficiary_management_reports.
 */
const { Op } = require("sequelize");
const {
  BeneficiaryManagementReport,
  StateOffice,
  ZonalOffice,
} = require("../models");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ACTIVITY_META = {
  additional_dependant: { label: "Additional Dependant" },
  extra_dependant: { label: "Extra-Dependent" },
  hcp_change: { label: "Change of HCP" },
  hmo_change: { label: "Change of HMO" },
  mda_hmo_selection: { label: "MDA Selection of New HMO" },
};
const CHANGE_TYPES = new Set(["hcp_change", "hmo_change"]);

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

const dashboard = async (req, res, next) => {
  try {
    const dashRole = resolveDashRole(req.user);
    if (!dashRole) {
      return res.status(403).json({ success: false, message: "Dashboard access is limited to State Coordinator, Zonal Director, SDO and DG" });
    }

    const q = req.query || {};
    const geo = scopeWhere(req.user, dashRole, q);
    const { where: period, year, month, quarter } = periodWhere(q);
    const where = { ...geo, ...period };

    if (q.activity_type && q.activity_type !== "all") where.activity_type = q.activity_type;
    if (q.status && q.status !== "all") where.activity_status = q.status;
    if (q.programme && q.programme !== "all") where.program_name = q.programme;
    // Change-specific filters — only meaningful for change activities.
    if (q.change_type && q.change_type !== "all") where.change_entity_type = q.change_type;
    if (q.reason && q.reason !== "all") where.reason_category = q.reason;
    if (q.current_provider && q.current_provider !== "all") where.current_provider = q.current_provider;
    if (q.new_provider && q.new_provider !== "all") where.new_provider = q.new_provider;

    const rows = await BeneficiaryManagementReport.findAll({
      where,
      attributes: [
        "reference_id", "activity_type", "zonal_code", "state_code", "status",
        "activity_status", "program_name", "mda",
        "change_entity_type", "reason_category", "current_provider", "new_provider",
        "reporting_year", "reporting_month", "request_date",
      ],
      raw: true,
    });

    const [states, zones] = await Promise.all([
      StateOffice.findAll({ attributes: ["code", "description", "zonal_code"], raw: true }).catch(() => []),
      ZonalOffice.findAll({ attributes: ["zonal_code", "description"], raw: true }).catch(() => []),
    ]);
    const stateName = Object.fromEntries(states.map((s) => [s.code, s.description]));
    const zoneName = Object.fromEntries(zones.map((z) => [z.zonal_code, z.description]));
    const scopeStates = states.filter((s) => !geo.zonal_code || s.zonal_code === geo.zonal_code)
      .filter((s) => !geo.state_code || s.code === geo.state_code);
    const scopeZones = geo.zonal_code ? zones.filter((z) => z.zonal_code === geo.zonal_code) : zones;

    const bump = (map, k, n = 1) => { if (k) map[k] = (map[k] || 0) + n; };
    const topList = (map, limit = 12) =>
      Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);

    const byActivity = {}; const byState = {}; const byZone = {};
    const byProgramme = {}; const byReason = {}; const byStatus = {};
    const byCurrentProvider = {}; const byNewProvider = {};
    const monthly = {};
    const stateAgg = {};

    for (const r of rows) {
      bump(byActivity, r.activity_type);
      bump(byZone, r.zonal_code || "—");
      bump(byProgramme, r.program_name);
      bump(byStatus, r.activity_status || "Unspecified");
      if (CHANGE_TYPES.has(r.activity_type)) {
        bump(byReason, r.reason_category);
        bump(byCurrentProvider, r.current_provider);
        bump(byNewProvider, r.new_provider);
      }
      const mk = `${r.reporting_year}-${String(r.reporting_month).padStart(2, "0")}`;
      bump(monthly, mk);

      const code = r.state_code || "—";
      bump(byState, code);
      if (!stateAgg[code]) stateAgg[code] = { activities: 0, changes: 0, dependants: 0 };
      stateAgg[code].activities += 1;
      if (CHANGE_TYPES.has(r.activity_type)) stateAgg[code].changes += 1;
      else stateAgg[code].dependants += 1;
    }

    const byActivityList = Object.entries(ACTIVITY_META).map(([key, meta]) => ({
      key, label: meta.label, value: byActivity[key] || 0,
    }));

    const statesList = Object.entries(stateAgg)
      .map(([code, v]) => ({ state_code: code, state_name: stateName[code] || code, ...v }))
      .sort((a, b) => b.activities - a.activities);

    const monthsInScope = month ? [month]
      : quarter ? [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, quarter * 3]
      : Array.from({ length: 12 }, (_, i) => i + 1);
    const trend = monthsInScope.map((m) => ({
      month: m, label: MONTHS[m - 1],
      activities: monthly[`${year}-${String(m).padStart(2, "0")}`] || 0,
    }));

    const total = rows.length;
    const changes = (byActivity.hcp_change || 0) + (byActivity.hmo_change || 0);
    const topReason = topList(byReason, 1)[0] || null;

    // Rising volume: last 3 months avg vs prior 3 months avg (year scope only).
    let volumeTrend = null;
    if (!month && !quarter) {
      const monthVals = trend.map((t) => t.activities);
      const lastIdx = monthVals.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
      if (lastIdx >= 5) {
        const recent = monthVals.slice(lastIdx - 2, lastIdx + 1).reduce((a, b) => a + b, 0) / 3;
        const prior = monthVals.slice(lastIdx - 5, lastIdx - 2).reduce((a, b) => a + b, 0) / 3;
        if (prior > 0) volumeTrend = Math.round(((recent - prior) / prior) * 100);
      }
    }

    // Management attention / queue items per the deck.
    const queue = [];
    if (dashRole === "sc") {
      const drafts = rows.filter((r) => r.status === "draft").length;
      if (drafts) queue.push({ issue: "Records still in draft", count: drafts, action: "Complete and submit the records." });
      if (changes) queue.push({ issue: "Provider change requests recorded", count: changes, action: "Confirm reasons meet NHIA criteria and follow up with providers." });
    } else if (dashRole === "zd") {
      const silent = scopeStates.filter((s) => !stateAgg[s.code]);
      for (const s of silent.slice(0, 5)) queue.push({ issue: `${s.description}: no activity recorded`, count: null, action: "Contact State Coordinator and confirm reporting." });
      const heavy = statesList.filter((x) => x.changes >= 3);
      for (const x of heavy.slice(0, 5)) queue.push({ issue: `${x.state_name}: high provider-change volume`, count: x.changes, action: "Review reasons with the state and coordinate provider support." });
    } else if (dashRole === "sdo") {
      if (topReason) queue.push({ issue: `Recurring change reason: ${topReason.name}`, count: topReason.value, action: "Review reported patterns with the responsible provider/HMO unit." });
      const silent = scopeStates.filter((s) => !stateAgg[s.code]).length;
      if (silent) queue.push({ issue: "States with no beneficiary-management activity", count: silent, action: "Review access and service availability gaps in network coverage." });
      if (volumeTrend != null && volumeTrend > 20) queue.push({ issue: "Increasing request volumes", count: `${volumeTrend > 0 ? "+" : ""}${volumeTrend}%`, action: "Confirm drivers and agree response with the relevant directorate." });
      const hmoAuth = Object.entries(byReason).filter(([k]) => /authori|approv/i.test(k)).reduce((a, [, v]) => a + v, 0);
      if (hmoAuth) queue.push({ issue: "HMO authorisation concerns", count: hmoAuth, action: "Review the authorisation process with the HMO oversight unit." });
    } else {
      const gaps = scopeZones.filter((z) => !byZone[z.zonal_code]);
      for (const z of gaps.slice(0, 5)) queue.push({ issue: `${z.description}: no activity recorded`, count: null, action: "Request a time-bound improvement plan from the zone." });
      if (volumeTrend != null && volumeTrend > 20) queue.push({ issue: "Sustained rise in requests", count: `+${volumeTrend}%`, action: "Review at management meetings and assign a responsible department." });
      if (topReason && topReason.value >= 5) queue.push({ issue: `Dominant change reason: ${topReason.name}`, count: topReason.value, action: "Direct a review of the underlying driver." });
    }

    res.json({
      success: true,
      data: {
        role: dashRole,
        period: { year, month, quarter, label: month ? `${MONTHS[month - 1]} ${year}` : quarter ? `Q${quarter} ${year}` : `${year}` },
        scope: { zonal_code: geo.zonal_code || null, state_code: geo.state_code || null },
        summary: {
          total,
          changes,
          dependant_requests: (byActivity.additional_dependant || 0) + (byActivity.extra_dependant || 0),
          states_reporting: Object.keys(stateAgg).filter((k) => k !== "—").length,
          states_total: scopeStates.length,
          zones_total: scopeZones.length,
          volume_trend_pct: volumeTrend,
        },
        by_activity: byActivityList,
        by_state: statesList,
        by_zone: topList(byZone).map((x) => ({ ...x, name: zoneName[x.name] || x.name })),
        by_programme: topList(byProgramme),
        by_reason: topList(byReason),
        by_status: topList(byStatus),
        current_providers: topList(byCurrentProvider, 10),
        new_providers: topList(byNewProvider, 10),
        trend,
        queue,
        catalogue: {
          activity_types: byActivityList.map((a) => a.label),
          programmes: Object.keys(byProgramme).sort(),
          statuses: Object.keys(byStatus).sort(),
          reasons: Object.keys(byReason).sort(),
          providers: Array.from(new Set([...Object.keys(byCurrentProvider), ...Object.keys(byNewProvider)])).sort(),
        },
      },
    });
  } catch (err) { next(err); }
};

module.exports = { dashboard };
