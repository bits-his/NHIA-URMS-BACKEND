/**
 * State Coordinator / operational home dashboard for rebuild mode.
 * Aggregates only APPROVED_FORMS models (flat packs with zonal_code / state_code).
 *
 * Shape matches the FE StateCoordinatorDashboard expectations.
 */
const { Op } = require("sequelize");
const {
  EnrolmentReport,
  EnrolmentDriveReport,
  BeneficiaryManagementReport,
  StakeholderReport,
  ProviderManagementReport,
  WeeklyComplianceReport,
  HmoIndebtednessReport,
  StateOffice,
  ZonalOffice,
} = require("../models");

const PENDING = new Set(["submitted", "awaiting_review", "reviewed", "endorsed"]);
const APPROVED = new Set(["approved", "endorsed"]);

const SOURCES = [
  { key: "enrolment", label: "Enrolment", model: EnrolmentReport, planField: null, conductedStatuses: null },
  { key: "enrolment_drive", label: "Enrolment Drive", model: EnrolmentDriveReport, planField: "planned_activities", conductedField: "activity_status" },
  { key: "beneficiary_management", label: "Beneficiary Management", model: BeneficiaryManagementReport },
  { key: "stakeholder", label: "Stakeholder Engagement", model: StakeholderReport, planField: "planned_activities", conductedField: "activity_status" },
  { key: "accreditation", label: "Provider Management", model: ProviderManagementReport, planField: "facilities_planned", coveredField: "facilities_covered", conductedField: "activity_status" },
  { key: "weekly_compliance", label: "Weekly Compliance", model: WeeklyComplianceReport },
  { key: "hmo_indebtedness", label: "HMO Indebtedness", model: HmoIndebtednessReport },
].filter((s) => !!s.model);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 1000) / 10;
}

function periodLabel(y, m) {
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
}

function shiftMonth(y, m, delta) {
  const d = new Date(y, m - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function resolvePeriod(query) {
  const now = new Date();
  const year = query.year ? Number(query.year) : now.getFullYear();
  const month = query.month && query.month !== "all" ? Number(query.month) : now.getMonth() + 1;
  return { year, month };
}

function geoWhere(user, query) {
  const where = {};
  const zonal = query.zonal_code || query.zone_id || user?.zonal_code || null;
  const state = query.state_code || query.state_id || user?.state_code || null;
  if (zonal && zonal !== "all") where.zonal_code = String(zonal);
  if (state && state !== "all") where.state_code = String(state);
  const role = String(user?.role || "");
  // Role defaults when FE omits locks
  if (!where.state_code && user?.state_code && (role.includes("state-coordinator") || role.endsWith("-state-coordinator"))) {
    where.state_code = user.state_code;
  }
  // Zonal coordinators must stay in their zone (never lock to a single state)
  if (!where.zonal_code && user?.zonal_code && !["sdo", "dg-ceo", "admin", "hq-department"].includes(role)) {
    where.zonal_code = user.zonal_code;
  }
  return where;
}

function periodWhere(base, year, month) {
  return { ...base, reporting_year: year, reporting_month: month };
}

function isSubmitted(status) {
  return PENDING.has(String(status || "").toLowerCase());
}

function isApproved(status) {
  return APPROVED.has(String(status || "").toLowerCase());
}

function isDraft(status) {
  return String(status || "").toLowerCase() === "draft";
}

function isConducted(status) {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "conducted" || s === "done";
}

async function loadSourceRows(Model, where, attributes) {
  if (!Model) return [];
  try {
    return await Model.findAll({ where, attributes, raw: true });
  } catch {
    return [];
  }
}

async function aggregateSources(geo, year, month) {
  const wherePeriod = periodWhere(geo, year, month);
  const prev = shiftMonth(year, month, -1);
  const wherePrev = periodWhere(geo, prev.year, prev.month);

  const byType = [];
  let curTotal = 0;
  let curSubmitted = 0;
  let curApproved = 0;
  let curDrafts = 0;
  let prevTotal = 0;
  let prevSubmitted = 0;
  let prevApproved = 0;
  let prevDrafts = 0;
  let planned = 0;
  let conducted = 0;

  const monthlyMap = {};

  for (const src of SOURCES) {
    const attrs = ["status", "reporting_year", "reporting_month"];
    if (src.planField) attrs.push(src.planField);
    if (src.coveredField) attrs.push(src.coveredField);
    if (src.conductedField && !attrs.includes(src.conductedField)) attrs.push(src.conductedField);

    const [curRows, prevRows, yearRows] = await Promise.all([
      loadSourceRows(src.model, wherePeriod, attrs),
      loadSourceRows(src.model, wherePrev, attrs),
      loadSourceRows(src.model, { ...geo, reporting_year: year }, attrs),
    ]);

    const submitted = curRows.filter((r) => isSubmitted(r.status)).length;
    const approved = curRows.filter((r) => isApproved(r.status)).length;
    const drafts = curRows.filter((r) => isDraft(r.status)).length;

    byType.push({
      key: src.key,
      label: src.label,
      reports: curRows.length,
      submitted,
      approved,
      drafts,
    });

    curTotal += curRows.length;
    curSubmitted += submitted;
    curApproved += approved;
    curDrafts += drafts;

    prevTotal += prevRows.length;
    prevSubmitted += prevRows.filter((r) => isSubmitted(r.status)).length;
    prevApproved += prevRows.filter((r) => isApproved(r.status)).length;
    prevDrafts += prevRows.filter((r) => isDraft(r.status)).length;

    for (const r of curRows) {
      if (src.planField === "planned_activities") planned += Math.max(1, num(r[src.planField]));
      else planned += 1;

      if (src.conductedField && isConducted(r[src.conductedField])) conducted += 1;
      else if (isApproved(r.status) || isSubmitted(r.status)) conducted += 1;
    }

    for (const r of yearRows) {
      const key = monthKey(r.reporting_year, r.reporting_month);
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, reports: 0, submitted: 0, approved: 0 };
      monthlyMap[key].reports += 1;
      if (isSubmitted(r.status)) monthlyMap[key].submitted += 1;
      if (isApproved(r.status)) monthlyMap[key].approved += 1;
    }
  }

  return {
    byType,
    curTotal,
    curSubmitted,
    curApproved,
    curDrafts,
    prevTotal,
    prevSubmitted,
    prevApproved,
    prevDrafts,
    planned,
    conducted,
    implementation_rate: planned > 0 ? pct(Math.min(conducted, planned), planned) : 0,
    monthlyMap,
    prev,
  };
}

/**
 * Per-state scorecard for zonal (and national) oversight — rebuild packs only.
 */
async function buildComparative(geo, year, month) {
  const zoneCode = geo.zonal_code || null;
  const stateFilter = geo.state_code || null;

  const stateWhere = {};
  if (zoneCode) stateWhere.zonal_code = zoneCode;
  if (stateFilter) stateWhere.code = stateFilter;

  let states = [];
  try {
    states = await StateOffice.findAll({
      where: Object.keys(stateWhere).length ? stateWhere : undefined,
      attributes: ["code", "description", "zonal_code"],
      order: [["description", "ASC"]],
      raw: true,
    });
  } catch {
    states = [];
  }

  if (!states.length) return null;

  const byState = {};
  for (const st of states) {
    byState[st.code] = {
      state_id: st.code,
      state_code: st.code,
      state_name: st.description,
      zone_id: st.zonal_code,
      zone_code: st.zonal_code,
      reports: 0,
      submitted: 0,
      approved: 0,
      drafts: 0,
      planned: 0,
      conducted: 0,
    };
  }

  const wherePeriod = periodWhere(
    {
      ...(zoneCode ? { zonal_code: zoneCode } : {}),
      ...(stateFilter ? { state_code: stateFilter } : {}),
    },
    year,
    month,
  );

  for (const src of SOURCES) {
    const attrs = ["status", "state_code", "zonal_code"];
    if (src.planField) attrs.push(src.planField);
    if (src.coveredField) attrs.push(src.coveredField);
    if (src.conductedField && !attrs.includes(src.conductedField)) attrs.push(src.conductedField);

    const rows = await loadSourceRows(src.model, wherePeriod, attrs);
    for (const r of rows) {
      const code = r.state_code ? String(r.state_code) : null;
      if (!code) continue;
      if (!byState[code]) {
        byState[code] = {
          state_id: code,
          state_code: code,
          state_name: code,
          zone_id: r.zonal_code || zoneCode,
          zone_code: r.zonal_code || zoneCode,
          reports: 0,
          submitted: 0,
          approved: 0,
          drafts: 0,
          planned: 0,
          conducted: 0,
        };
      }
      const bucket = byState[code];
      bucket.reports += 1;
      if (isSubmitted(r.status)) bucket.submitted += 1;
      if (isApproved(r.status)) bucket.approved += 1;
      if (isDraft(r.status)) bucket.drafts += 1;

      if (src.planField === "planned_activities") bucket.planned += Math.max(1, num(r[src.planField]));
      else if (src.planField === "facilities_planned") bucket.planned += Math.max(1, num(r[src.planField]));
      else bucket.planned += 1;

      if (src.conductedField && isConducted(r[src.conductedField])) bucket.conducted += 1;
      else if (isApproved(r.status) || isSubmitted(r.status)) bucket.conducted += 1;
    }
  }

  // Resolve zone names once
  let zoneNames = {};
  try {
    const zoneList = await ZonalOffice.findAll({ attributes: ["zonal_code", "description"], raw: true });
    for (const z of zoneList) zoneNames[z.zonal_code] = z.description;
  } catch { /* */ }

  const stateRows = Object.values(byState).map((s) => {
    const completion_rate = pct(s.approved, s.reports || 1);
    const implementation_rate = s.planned > 0
      ? pct(Math.min(s.conducted, s.planned), s.planned)
      : 0;
    const intervention_score =
      (s.drafts * 2) + (s.submitted * 3)
      + (implementation_rate < 70 && s.planned > 0 ? 5 : 0)
      + (s.reports === 0 ? 4 : 0);

    let band = "performing";
    if (s.reports === 0 || completion_rate < 50 || intervention_score >= 12) band = "needs_intervention";
    else if (completion_rate < 75 || implementation_rate < 70 || s.drafts > 2) band = "lagging";

    const zCode = s.zone_code || s.zone_id;
    return {
      ...s,
      zone_id: zCode,
      zone_name: zoneNames[zCode] || zCode || "—",
      completion_rate,
      implementation_rate,
      intervention_score,
      band,
      open_actionables: 0,
      open_challenges: 0,
      escalated_actionables: 0,
    };
  }).sort((a, b) => a.state_name.localeCompare(b.state_name));

  const performing = stateRows.filter((s) => s.band === "performing");
  const lagging = stateRows.filter((s) => s.band === "lagging");
  const needs_intervention = stateRows.filter((s) => s.band === "needs_intervention");

  const avg = (arr, key) => (arr.length
    ? Math.round((arr.reduce((sum, r) => sum + (Number(r[key]) || 0), 0) / arr.length) * 10) / 10
    : 0);

  // Zone rollup for SDO national view
  const byZone = {};
  for (const s of stateRows) {
    const zid = s.zone_id || "unknown";
    if (!byZone[zid]) {
      byZone[zid] = {
        zone_id: zid,
        zone_name: s.zone_name || zid,
        states: 0,
        reports: 0,
        submitted: 0,
        approved: 0,
        drafts: 0,
        planned: 0,
        conducted: 0,
        performing: 0,
        lagging: 0,
        needs_intervention: 0,
        escalated_actionables: 0,
      };
    }
    const z = byZone[zid];
    z.states += 1;
    z.reports += s.reports;
    z.submitted += s.submitted;
    z.approved += s.approved;
    z.drafts += s.drafts;
    z.planned += s.planned;
    z.conducted += s.conducted;
    if (s.band === "performing") z.performing += 1;
    else if (s.band === "lagging") z.lagging += 1;
    else z.needs_intervention += 1;
  }
  const zones = Object.values(byZone).map((z) => {
    const completion_rate = pct(z.approved, z.reports || 1);
    const implementation_rate = z.planned > 0
      ? pct(Math.min(z.conducted, z.planned), z.planned)
      : 0;
    const compliance_rate = z.states > 0
      ? pct(z.performing + z.lagging, z.states)
      : 0;
    return {
      ...z,
      completion_rate,
      implementation_rate,
      compliance_rate,
    };
  }).sort((a, b) => a.zone_name.localeCompare(b.zone_name));

  const recurring_problems = [];
  const pendingStates = stateRows.filter((s) => s.submitted > 0).length;
  const draftStates = stateRows.filter((s) => s.drafts > 0).length;
  const noReportStates = stateRows.filter((s) => s.reports === 0).length;
  const lowImplStates = stateRows.filter((s) => s.planned > 0 && s.implementation_rate < 70).length;
  if (pendingStates) recurring_problems.push({ key: "pending_review", label: "Pending review", states_affected: pendingStates });
  if (draftStates) recurring_problems.push({ key: "draft_backlog", label: "Draft backlog", states_affected: draftStates });
  if (lowImplStates) recurring_problems.push({ key: "low_implementation", label: "Low implementation vs plan", states_affected: lowImplStates });
  if (noReportStates) recurring_problems.push({ key: "no_reports", label: "No reports this month", states_affected: noReportStates });

  const byCompletion = [...stateRows].sort((a, b) => b.completion_rate - a.completion_rate || b.reports - a.reports);
  const escalations = needs_intervention.map((s) => ({
    state_id: s.state_id,
    state_name: s.state_name,
    zone_id: s.zone_id,
    zone_name: s.zone_name,
    tier: s.reports === 0 ? "sdo" : (s.completion_rate < 40 ? "dg" : "department"),
    label: s.reports === 0 ? "No reports" : "Needs intervention",
    reason: `${s.completion_rate}% completion · ${s.submitted} pending · ${s.drafts} drafts`,
    count: s.intervention_score,
  }));

  const avgCompletion = avg(stateRows, "completion_rate");
  const avgImplementation = avg(stateRows, "implementation_rate");

  return {
    period: { year, month, label: periodLabel(year, month) },
    summary: {
      states_in_scope: stateRows.length,
      states_total: stateRows.length,
      zones_total: zones.length,
      performing: performing.length,
      lagging: lagging.length,
      needs_intervention: needs_intervention.length,
      zone_avg_completion: avgCompletion,
      zone_avg_implementation: avgImplementation,
      national_avg_completion: avgCompletion,
      national_avg_implementation: avgImplementation,
      escalations_total: escalations.length,
      escalated_actionables: 0,
    },
    states: stateRows,
    zones,
    performing,
    lagging,
    needs_intervention,
    intervention_states: needs_intervention,
    recurring_problems,
    challenge_patterns: [],
    support_requirements: [],
    department_load: [],
    escalations,
    top_states: byCompletion.slice(0, 8),
    bottom_states: [...byCompletion].reverse().slice(0, 8),
  };
}

function buildOperational(agg, year, month) {
  const curCompletion = pct(agg.curApproved, agg.curTotal || 1);
  const prevCompletion = pct(agg.prevApproved, agg.prevTotal || 1);
  const off_track = [];
  if (agg.curDrafts > 0) {
    off_track.push({
      key: "drafts",
      label: "Draft reports not submitted",
      count: agg.curDrafts,
      severity: agg.curDrafts >= 5 ? "high" : "medium",
      reason: `Still in draft for ${periodLabel(year, month)}`,
    });
  }
  if (agg.curSubmitted > 0) {
    off_track.push({
      key: "pending_review",
      label: "Awaiting your review",
      count: agg.curSubmitted,
      severity: "high",
      reason: "Submitted reports need coordinator action",
    });
  }
  if (agg.planned > 0 && agg.implementation_rate < 70) {
    off_track.push({
      key: "implementation",
      label: "Activity implementation below 70%",
      count: agg.implementation_rate,
      severity: agg.implementation_rate < 50 ? "high" : "medium",
      reason: `${agg.conducted} of ${agg.planned} planned volume completed`,
    });
  }

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const p = shiftMonth(year, month, -i);
    const key = monthKey(p.year, p.month);
    const row = agg.monthlyMap[key] || { month: key, reports: 0, submitted: 0, approved: 0 };
    trend.push({
      month: key,
      label: periodLabel(p.year, p.month).split(" ")[0],
      reports: row.reports || 0,
      submitted: row.submitted || 0,
      approved: row.approved || 0,
    });
  }

  return {
    current_period: { year, month, label: periodLabel(year, month) },
    previous_period: { year: agg.prev.year, month: agg.prev.month, label: periodLabel(agg.prev.year, agg.prev.month) },
    current: {
      reports: agg.curTotal,
      submitted: agg.curSubmitted,
      approved: agg.curApproved,
      drafts: agg.curDrafts,
      completion_rate: curCompletion,
    },
    previous: {
      reports: agg.prevTotal,
      submitted: agg.prevSubmitted,
      approved: agg.prevApproved,
      drafts: agg.prevDrafts,
      completion_rate: prevCompletion,
    },
    vs_previous: {
      reports_delta_pct: agg.prevTotal
        ? Math.round(((agg.curTotal - agg.prevTotal) / agg.prevTotal) * 1000) / 10
        : null,
      submitted_delta_pct: null,
      approved_delta_pct: null,
      completion_delta_pp: Math.round((curCompletion - prevCompletion) * 10) / 10,
    },
    planned_activities: agg.planned,
    activities_conducted: agg.conducted,
    implementation_rate: agg.implementation_rate,
    needs_action: {
      pending_review: agg.curSubmitted,
      open_actionables: 0,
      draft_reports: agg.curDrafts,
      open_challenges: 0,
      total: agg.curSubmitted + agg.curDrafts,
    },
    off_track,
    period_trend: trend,
  };
}

const dashboard = async (req, res, next) => {
  try {
    const { year, month } = resolvePeriod(req.query);
    const geo = geoWhere(req.user, req.query);
    const agg = await aggregateSources(geo, year, month);
    const operational = buildOperational(agg, year, month);
    const comparative = await buildComparative(geo, year, month);

    let scopeLabel = null;
    if (geo.state_code) {
      const st = await StateOffice.findOne({ where: { code: geo.state_code }, attributes: ["description"] });
      scopeLabel = st?.description || geo.state_code;
    } else if (geo.zonal_code && ZonalOffice) {
      const z = await ZonalOffice.findByPk(geo.zonal_code, { attributes: ["description"] });
      scopeLabel = z?.description || geo.zonal_code;
    }

    res.json({
      success: true,
      data: {
        mode: "rebuild-approved-forms",
        scope: { ...geo, label: scopeLabel },
        operational,
        comparative,
        reports_by_type: agg.byType
          .filter((t) => t.reports > 0)
          .sort((a, b) => b.reports - a.reports),
        approved_sources: SOURCES.map((s) => s.key),
      },
    });
  } catch (err) {
    next(err);
  }
};

const dashboardDrill = async (req, res, next) => {
  try {
    const { year, month } = resolvePeriod(req.query);
    const geo = geoWhere(req.user, req.query);
    // Drill may narrow further to a state (zonal → state)
    if (req.query.state_id && req.query.state_id !== "all") {
      geo.state_code = String(req.query.state_id);
    }
    if (req.query.state_code && req.query.state_code !== "all") {
      geo.state_code = String(req.query.state_code);
    }
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;
    const typeFilter = req.query.report_type ? String(req.query.report_type) : null;
    const monthFilter = req.query.month && String(req.query.month).includes("-")
      ? String(req.query.month)
      : null;
    const segment = req.query.segment ? String(req.query.segment) : null;

    // Zone breakdown for SDO national drill
    if (segment === "zone_breakdown") {
      const comparative = await buildComparative(geo, year, month);
      const zones = comparative?.zones || [];
      return res.json({
        success: true,
        data: zones.map((z) => ({
          id: z.zone_id,
          title: z.zone_name,
          subtitle: `${z.states} states · ${z.completion_rate}% complete · ${z.reports} reports`,
          status: `${z.performing} performing`,
          meta: `zone:${z.zone_id}`,
          zone_id: z.zone_id,
          zone_name: z.zone_name,
          reference: null,
          date: null,
        })),
      });
    }

    // State breakdown for zonal / SDO drill: return one row per state
    if (segment === "state_breakdown") {
      const comparative = await buildComparative(geo, year, month);
      const states = comparative?.states || [];
      return res.json({
        success: true,
        data: states.map((s) => ({
          id: s.state_id,
          title: s.state_name,
          subtitle: `${s.completion_rate}% complete · ${s.reports} reports`,
          status: s.band,
          meta: `state:${s.state_id}`,
          state_id: s.state_id,
          state_name: s.state_name,
          zone_id: s.zone_id,
          zone_name: s.zone_name,
          reference: null,
          date: null,
        })),
      });
    }

    const rows = [];
    for (const src of SOURCES) {
      if (typeFilter && typeFilter !== "all_reports" && typeFilter !== src.key) continue;
      let where = { ...geo };
      if (monthFilter) {
        const [y, m] = monthFilter.split("-").map(Number);
        where = periodWhere(where, y, m);
      } else {
        where = periodWhere(where, year, month);
      }
      if (statusFilter === "submitted") where.status = { [Op.in]: [...PENDING] };
      else if (statusFilter === "draft") where.status = "draft";
      else if (statusFilter === "approved") where.status = { [Op.in]: [...APPROVED] };
      else if (statusFilter) where.status = statusFilter;

      const found = await loadSourceRows(src.model, where, [
        "reference_id", "status", "reporting_year", "reporting_month", "state_code", "zonal_code", "submitted_by",
      ]);
      for (const r of found) {
        rows.push({
          id: r.reference_id,
          reference: r.reference_id,
          title: src.label,
          subtitle: `${r.state_code || "—"} · ${periodLabel(r.reporting_year, r.reporting_month)}`,
          status: r.status,
          meta: `report_type:${src.key}`,
          report_type: src.key,
          report_id: r.reference_id,
          state_id: r.state_code || null,
          submitted_by: r.submitted_by || null,
        });
      }
    }

    res.json({ success: true, data: rows.slice(0, 200) });
  } catch (err) {
    next(err);
  }
};

module.exports = { dashboard, dashboardDrill, SOURCES };
