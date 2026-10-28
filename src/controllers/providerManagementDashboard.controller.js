/**
 * Provider Management dashboards — four levels on provider_management_reports.
 * KPIs match the Provider Management Dashboards PPT (plan achievement,
 * facility coverage, activity completion, separate accreditation pipelines).
 */
const { Op } = require("sequelize");
const {
  ProviderManagementReport,
  StateOffice,
  ZonalOffice,
} = require("../models");

const ACTIVITY_KEYS = ["accreditation", "reaccreditation", "qa-inspections", "medical-audits"];
const ACTIVITY_LABELS = {
  accreditation: "Accreditation",
  reaccreditation: "Reaccreditation",
  "qa-inspections": "Quality Assurance",
  "medical-audits": "Medical Audit",
};

const COMPLETED_STATUSES = new Set(["Completed", "completed"]);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(numr, den) {
  if (!den || den <= 0) return null;
  return Math.round((numr / den) * 1000) / 10;
}

function resolvePeriod(query) {
  const year = query.year ? Number(query.year) : null;
  const month = query.month && query.month !== "all" ? Number(query.month) : null;
  const quarter = query.quarter && query.quarter !== "all" ? Number(query.quarter) : null;
  const period = String(query.period || "").toLowerCase().trim();
  return { year, month, quarter, period };
}

function monthsForQuarter(q) {
  const start = (q - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

function buildListWhere(user, query) {
  const where = {};
  const zonal = query.zonal_code || query.zone_id;
  const state = query.state_code || query.state_id;
  if (zonal) where.zonal_code = zonal;
  if (state) where.state_code = state;

  const { year, month, quarter, period } = resolvePeriod(query);
  if (year) where.reporting_year = year;
  if (month) {
    where.reporting_month = month;
  } else if (quarter && quarter >= 1 && quarter <= 4) {
    where.reporting_month = { [Op.in]: monthsForQuarter(quarter) };
  } else if (period === "ytd") {
    const now = new Date();
    const ytdYear = year || now.getFullYear();
    const endMonth = ytdYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    where.reporting_year = ytdYear;
    where.reporting_month = { [Op.in]: Array.from({ length: endMonth }, (_, i) => i + 1) };
  } else if (query.year) {
    where.reporting_year = Number(query.year);
  }

  // Role geo defaults (same pattern as providerPack.listReports)
  if (!zonal && user?.zonal_code && !["sdo", "dg-ceo", "hq-department", "admin"].includes(user.role)) {
    where.zonal_code = user.zonal_code;
  }
  if (!state && user?.state_code && String(user.role || "").includes("state")) {
    where.state_code = user.state_code;
  }

  return where;
}

async function loadScopedReports(user, query) {
  const where = buildListWhere(user, query);
  return ProviderManagementReport.findAll({
    where,
    include: [
      { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
      { model: StateOffice, as: "state", attributes: ["code", "description"] },
    ],
    order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]],
  });
}

function flattenActivities(reports, filters = {}) {
  const programmeFilter = filters.programme && filters.programme !== "all"
    ? String(filters.programme)
    : null;
  const activityFilter = filters.activity && filters.activity !== "all"
    ? String(filters.activity)
    : null;
  const statusFilter = filters.activity_status && filters.activity_status !== "all"
    ? String(filters.activity_status)
    : null;

  const rows = [];
  for (const report of reports) {
    const json = typeof report.toJSON === "function" ? report.toJSON() : report;
    const activity = ACTIVITY_KEYS.includes(json.form_type) ? json.form_type : "accreditation";
    const programme = json.related_programme ? String(json.related_programme) : "Unspecified";
    const activityStatus = json.activity_status || "Unknown";
    if (programmeFilter && programme !== programmeFilter) continue;
    if (activityFilter && activity !== activityFilter) continue;
    if (statusFilter && activityStatus !== statusFilter) continue;

    const planned = num(json.facilities_planned);
    const covered = num(json.facilities_covered);
    const totalState = num(json.total_facilities_in_state);
    const awaitingAcc = num(json.awaiting_accreditation ?? json.phcs_awaiting_accreditation);
    const awaitingRe = num(json.awaiting_reaccreditation ?? json.phcs_awaiting_reaccreditation);
    // Flat pack stores delivered volume in facilities_covered for the activity type.
    const accredited = activity === "accreditation" ? covered : 0;
    const reaccredited = activity === "reaccreditation" ? covered : 0;
    const isBhcpf = programme === "BHCPF";
    const bhcpfAwaitAcc = isBhcpf ? num(json.phcs_awaiting_accreditation ?? awaitingAcc) : 0;
    const bhcpfAwaitRe = isBhcpf ? num(json.phcs_awaiting_reaccreditation ?? awaitingRe) : 0;

    rows.push({
      report_id: json.reference_id,
      reference_id: json.reference_id,
      report_status: json.status,
      zone_id: json.zonal_code,
      state_id: json.state_code,
      zone: json.zone?.description || `Zone ${json.zonal_code || "—"}`,
      state: json.state?.description || `State ${json.state_code || "—"}`,
      year: json.reporting_year,
      month: json.reporting_month,
      activity,
      activity_label: ACTIVITY_LABELS[activity] || activity,
      programme,
      activity_status: activityStatus,
      planned,
      covered,
      total_state: totalState,
      awaiting_accreditation: activity === "accreditation" ? awaitingAcc : 0,
      awaiting_reaccreditation: activity === "reaccreditation" ? awaitingRe : 0,
      accredited,
      reaccredited,
      bhcpf_phcs_accredited: isBhcpf && activity === "accreditation" ? covered : 0,
      bhcpf_phcs_reaccredited: isBhcpf && activity === "reaccreditation" ? covered : 0,
      bhcpf_awaiting_accreditation: activity === "accreditation" ? bhcpfAwaitAcc : 0,
      bhcpf_awaiting_reaccreditation: activity === "reaccreditation" ? bhcpfAwaitRe : 0,
      completed: COMPLETED_STATUSES.has(activityStatus),
    });
  }
  return rows;
}

function sumField(rows, field) {
  return rows.reduce((s, r) => s + num(r[field]), 0);
}

/** One facility-stock total per state (avoid double-counting across activity lines). */
function uniqueStateFacilityStock(rows) {
  const byState = new Map();
  for (const r of rows) {
    if (r.state_id == null) continue;
    const cur = byState.get(r.state_id) || 0;
    if (num(r.total_state) > cur) byState.set(r.state_id, num(r.total_state));
  }
  return [...byState.values()].reduce((a, b) => a + b, 0);
}

function previousPeriodQuery(query) {
  const year = query.year ? Number(query.year) : new Date().getFullYear();
  const month = query.month && query.month !== "all" ? Number(query.month) : null;
  const quarter = query.quarter && query.quarter !== "all" ? Number(query.quarter) : null;
  const period = String(query.period || "").toLowerCase().trim();
  const next = { ...query };
  if (month) {
    if (month === 1) {
      next.year = String(year - 1);
      next.month = "12";
    } else {
      next.month = String(month - 1);
    }
    next.quarter = "all";
    next.period = undefined;
  } else if (quarter) {
    if (quarter === 1) {
      next.year = String(year - 1);
      next.quarter = "4";
    } else {
      next.quarter = String(quarter - 1);
    }
    next.month = "all";
    next.period = undefined;
  } else if (period === "ytd") {
    next.year = String(year - 1);
    next.period = "ytd";
    next.month = "all";
    next.quarter = "all";
  } else {
    next.year = String(year - 1);
  }
  return next;
}

function groupSum(rows, keyFn, fields) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) {
      const base = { key, label: key };
      for (const f of fields) base[f] = 0;
      map.set(key, base);
    }
    const g = map.get(key);
    for (const f of fields) g[f] += num(row[f]);
  }
  return [...map.values()];
}

function buildActionQueue(rows, level) {
  const inProgress = rows.filter((r) => /in progress/i.test(r.activity_status)).length;
  const notConducted = rows.filter((r) => /not conducted/i.test(r.activity_status)).length;
  const overCovered = rows.filter((r) => r.planned > 0 && r.covered > r.planned).length;
  const deferred = rows.filter((r) => /deferred/i.test(r.activity_status)).length;
  const items = [];
  if (inProgress) items.push(`${inProgress} activit${inProgress === 1 ? "y" : "ies"} in progress`);
  if (notConducted) items.push(`${notConducted} planned activit${notConducted === 1 ? "y" : "ies"} not conducted`);
  if (deferred) items.push(`${deferred} deferred`);
  if (overCovered) items.push(`Review facility counts where covered exceeds planned`);
  if (level === 1) {
    items.push("Drill down to activity record and evidence");
  } else if (level === 2) {
    items.push("Prioritise states below the approved target");
    items.push("Review causes with the state coordinator before escalation; compare rates, not raw counts alone");
  } else if (level === 3) {
    items.push("Identify zones with sustained low plan achievement");
    items.push("Separate accreditation and reaccreditation outputs");
    items.push("Review programme-specific BHCPF PHC counts");
    items.push("Escalate recurring operational barriers");
  } else if (level === 4) {
    return [
      "Direct follow-up by programme and activity; request time-bound improvement plans from zones; monitor accreditation and re-accreditation separately.",
    ];
  }
  if (!items.length) items.push("No urgent operational exceptions in the selected filters");
  return items;
}

function buildActivityAnalysis(rows) {
  const defs = [
    {
      key: "accreditation",
      title: "Accreditation",
      bullets: (g) => [
        `Facilities awaiting accreditation: ${g.awaiting_accreditation}`,
        `Facilities accredited this period: ${g.accredited}`,
        `BHCPF PHCs awaiting / accredited: ${g.bhcpf_awaiting} / ${g.bhcpf_phcs_accredited}`,
      ],
      rate: (g) => pct(g.accredited, g.planned),
    },
    {
      key: "reaccreditation",
      title: "Reaccreditation",
      bullets: (g) => [
        `Facilities awaiting reaccreditation: ${g.awaiting_reaccreditation}`,
        `Facilities re-accredited this period: ${g.reaccredited}`,
        `BHCPF PHCs awaiting / re-accredited: ${g.bhcpf_awaiting_re} / ${g.bhcpf_phcs_reaccredited}`,
      ],
      rate: (g) => pct(g.reaccredited, g.planned),
    },
    {
      key: "qa-inspections",
      title: "Quality Assurance",
      bullets: (g) => [
        `Facilities planned for visits: ${g.planned}`,
        `Facilities visited / covered: ${g.covered}`,
        `Plan achievement: ${pct(g.covered, g.planned) ?? "—"}%`,
      ],
      rate: (g) => pct(g.covered, g.planned),
    },
    {
      key: "medical-audits",
      title: "Medical Audit",
      bullets: (g) => [
        `Planned audit activities: ${g.count}`,
        `Facilities covered: ${g.covered}`,
        `Completed records: ${g.completed_count}`,
      ],
      rate: (g) => pct(g.covered, g.planned),
    },
  ];

  return defs.map((d) => {
    const subset = rows.filter((r) => r.activity === d.key);
    const g = {
      planned: sumField(subset, "planned"),
      covered: sumField(subset, "covered"),
      awaiting_accreditation: sumField(subset, "awaiting_accreditation"),
      awaiting_reaccreditation: sumField(subset, "awaiting_reaccreditation"),
      accredited: sumField(subset, "accredited"),
      reaccredited: sumField(subset, "reaccredited"),
      bhcpf_phcs_accredited: sumField(subset, "bhcpf_phcs_accredited"),
      bhcpf_phcs_reaccredited: sumField(subset, "bhcpf_phcs_reaccredited"),
      bhcpf_awaiting: sumField(subset, "bhcpf_awaiting_accreditation"),
      bhcpf_awaiting_re: sumField(subset, "bhcpf_awaiting_reaccreditation"),
      count: subset.length,
      completed_count: subset.filter((r) => r.completed).length,
    };
    const byState = groupSum(subset, (r) => r.state, ["planned", "covered", "accredited", "reaccredited"]).map((s) => ({
      name: s.label,
      planned: s.planned,
      covered: s.covered,
      plan_achievement: pct(s.covered, s.planned),
    }));
    const byMonth = groupSum(subset, (r) => `${r.year}-${String(r.month).padStart(2, "0")}`, ["planned", "covered"]).map((m) => ({
      period: m.label,
      planned: m.planned,
      covered: m.covered,
    })).sort((a, b) => a.period.localeCompare(b.period));
    const statusCounts = {};
    for (const r of subset) statusCounts[r.activity_status] = (statusCounts[r.activity_status] || 0) + 1;
    const byStatus = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));
    return {
      key: d.key,
      title: d.title,
      bullets: d.bullets(g),
      plan_achievement: d.rate(g),
      by_state: byState.slice(0, 8),
      by_month: byMonth,
      by_status: byStatus,
      ...g,
    };
  });
}

function signalFor(awaiting, output, rate) {
  if (awaiting > output * 1.2) return { signal: "Pending high", focus: "Review pipeline by zone" };
  if (rate != null && rate < 60) return { signal: "Output below plan", focus: "Check visit plans" };
  if (rate != null && rate < 75) return { signal: "Uneven output", focus: "Target low-output zones" };
  return { signal: "On track", focus: "Maintain monitoring cadence" };
}

function buildPriorityAreas(rows) {
  const fsshipAcc = rows.filter((r) => r.programme === "FSSHIP" && r.activity === "accreditation");
  const reacc = rows.filter((r) => r.activity === "reaccreditation");
  const bhcpf = rows.filter((r) => r.programme === "BHCPF");

  const blocks = [
    {
      area: "FSSHIP accreditation",
      awaiting: sumField(fsshipAcc, "awaiting_accreditation"),
      output: sumField(fsshipAcc, "accredited"),
      rate: pct(sumField(fsshipAcc, "covered"), sumField(fsshipAcc, "planned")),
    },
    {
      area: "Reaccreditation",
      awaiting: sumField(reacc, "awaiting_reaccreditation"),
      output: sumField(reacc, "reaccredited"),
      rate: pct(sumField(reacc, "covered"), sumField(reacc, "planned")),
    },
    {
      area: "BHCPF PHCs",
      awaiting: sumField(bhcpf, "bhcpf_awaiting_accreditation") + sumField(bhcpf, "bhcpf_awaiting_reaccreditation"),
      output: sumField(bhcpf, "bhcpf_phcs_accredited") + sumField(bhcpf, "bhcpf_phcs_reaccredited"),
      rate: pct(sumField(bhcpf, "covered"), sumField(bhcpf, "planned")),
    },
  ];

  return blocks.map((b) => {
    const { signal, focus } = signalFor(b.awaiting, b.output, b.rate);
    return {
      area: b.area,
      signal,
      focus,
      plan_achievement: b.rate,
      awaiting: b.awaiting,
      output: b.output,
    };
  });
}

function buildPayload(rows, level) {
  const plannedFacilities = sumField(rows, "planned");
  const coveredFacilities = sumField(rows, "covered");
  const totalStateFacilities = uniqueStateFacilityStock(rows);
  const activityRecords = rows.length;
  const completedRecords = rows.filter((r) => r.completed).length;

  const kpis = {
    activities_planned: activityRecords,
    activities_completed: completedRecords,
    activity_completion_rate: pct(completedRecords, activityRecords),
    facilities_planned: plannedFacilities,
    facilities_covered: coveredFacilities,
    plan_achievement_rate: pct(coveredFacilities, plannedFacilities),
    facility_coverage_rate: pct(coveredFacilities, totalStateFacilities),
    awaiting_accreditation: sumField(rows, "awaiting_accreditation"),
    accredited: sumField(rows, "accredited"),
    awaiting_reaccreditation: sumField(rows, "awaiting_reaccreditation"),
    reaccredited: sumField(rows, "reaccredited"),
    bhcpf_phcs_accredited: sumField(rows, "bhcpf_phcs_accredited"),
    bhcpf_phcs_reaccredited: sumField(rows, "bhcpf_phcs_reaccredited"),
    bhcpf_awaiting_accreditation: sumField(rows, "bhcpf_awaiting_accreditation"),
    bhcpf_awaiting_reaccreditation: sumField(rows, "bhcpf_awaiting_reaccreditation"),
  };

  const activityCounts = {};
  for (const r of rows) {
    activityCounts[r.activity_label] = (activityCounts[r.activity_label] || 0) + 1;
  }
  const byActivity = groupSum(rows, (r) => r.activity_label, ["planned", "covered"]).map((g) => ({
    name: g.label,
    planned: g.planned,
    covered: g.covered,
    count: activityCounts[g.label] || 0,
    plan_achievement: pct(g.covered, g.planned),
  }));

  const statusCounts = {};
  for (const r of rows) {
    statusCounts[r.activity_status] = (statusCounts[r.activity_status] || 0) + 1;
  }
  const byStatus = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));

  const byState = groupSum(rows, (r) => r.state, ["planned", "covered"]).map((g) => ({
    name: g.label,
    planned: g.planned,
    covered: g.covered,
    plan_achievement: pct(g.covered, g.planned),
  })).sort((a, b) => (b.plan_achievement ?? -1) - (a.plan_achievement ?? -1));

  const byZone = groupSum(rows, (r) => r.zone, [
    "planned", "covered", "accredited", "reaccredited",
    "awaiting_accreditation", "awaiting_reaccreditation",
  ]).map((g) => ({
    name: g.label,
    planned: g.planned,
    covered: g.covered,
    accredited: g.accredited,
    reaccredited: g.reaccredited,
    awaiting_accreditation: g.awaiting_accreditation,
    awaiting_reaccreditation: g.awaiting_reaccreditation,
    plan_achievement: pct(g.covered, g.planned),
  })).sort((a, b) => (b.plan_achievement ?? -1) - (a.plan_achievement ?? -1));

  const monthMap = new Map();
  for (const r of rows) {
    const y = Number(r.year);
    const m = Number(r.month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) continue;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        period: key,
        label: new Date(y, m - 1, 1).toLocaleString("en", { month: "short" }),
        year: y,
        month: m,
        planned: 0,
        covered: 0,
        accredited: 0,
        reaccredited: 0,
        bhcpf_phcs_accredited: 0,
        planned_records: 0,
        completed_records: 0,
      });
    }
    const g = monthMap.get(key);
    g.planned += num(r.planned);
    g.covered += num(r.covered);
    g.accredited += num(r.accredited);
    g.reaccredited += num(r.reaccredited);
    g.bhcpf_phcs_accredited += num(r.bhcpf_phcs_accredited);
    g.planned_records += 1;
    if (r.completed) g.completed_records += 1;
  }

  const yearsInRows = [...new Set([...monthMap.values()].map((g) => g.year))];
  const padYear = yearsInRows.length === 1
    ? yearsInRows[0]
    : (rows[0]?.year ? Number(rows[0].year) : new Date().getFullYear());
  if (Number.isFinite(padYear)) {
    for (let m = 1; m <= 12; m++) {
      const key = `${padYear}-${String(m).padStart(2, "0")}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          period: key,
          label: new Date(padYear, m - 1, 1).toLocaleString("en", { month: "short" }),
          year: padYear,
          month: m,
          planned: 0,
          covered: 0,
          accredited: 0,
          reaccredited: 0,
          bhcpf_phcs_accredited: 0,
          planned_records: 0,
          completed_records: 0,
        });
      }
    }
  }

  const byMonth = [...monthMap.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((g) => ({
      period: g.period,
      label: g.label,
      planned: g.planned,
      covered: g.covered,
      accredited: g.accredited,
      reaccredited: g.reaccredited,
      bhcpf_phcs_accredited: g.bhcpf_phcs_accredited,
      planned_records: g.planned_records,
      completed_records: g.completed_records,
      completed: g.completed_records,
    }));

  const byProgramme = groupSum(
    rows,
    (r) => r.programme,
    ["planned", "covered", "accredited", "reaccredited", "bhcpf_phcs_accredited", "bhcpf_phcs_reaccredited"],
  ).map((g) => ({
    name: g.label,
    planned: g.planned,
    covered: g.covered,
    accredited: g.accredited,
    reaccredited: g.reaccredited,
    bhcpf_phcs_accredited: g.bhcpf_phcs_accredited,
    bhcpf_phcs_reaccredited: g.bhcpf_phcs_reaccredited,
    plan_achievement: pct(g.covered, g.planned),
  }));

  const fsship = rows.filter((r) => r.programme === "FSSHIP");
  const bhcpf = rows.filter((r) => r.programme === "BHCPF");
  const programmeKpis = {
    fsship_accredited: sumField(fsship, "accredited"),
    fsship_reaccredited: sumField(fsship, "reaccredited"),
    bhcpf_phcs_accredited: sumField(bhcpf, "bhcpf_phcs_accredited"),
    bhcpf_phcs_reaccredited: sumField(bhcpf, "bhcpf_phcs_reaccredited"),
  };

  const pipelineBars = [
    { name: "Awaiting", value: kpis.awaiting_accreditation + kpis.awaiting_reaccreditation },
    { name: "Accredited", value: kpis.accredited + kpis.reaccredited },
    { name: "Planned", value: plannedFacilities },
    { name: "Covered", value: coveredFacilities },
  ];

  const programmeActivityOutputs = [
    { name: "FSSHIP Acc", value: sumField(fsship.filter((r) => r.activity === "accreditation"), "accredited") },
    { name: "FSSHIP Re-acc", value: sumField(fsship.filter((r) => r.activity === "reaccreditation"), "reaccredited") },
    { name: "BHCPF Acc", value: programmeKpis.bhcpf_phcs_accredited },
    { name: "BHCPF Re-acc", value: programmeKpis.bhcpf_phcs_reaccredited },
  ];

  const execTrend = byMonth.map((m) => {
    const inMonth = (r) => `${r.year}-${String(r.month).padStart(2, "0")}` === m.period;
    return {
      label: m.label,
      period: m.period,
      fsship_accreditation: sumField(rows.filter((r) => r.programme === "FSSHIP" && r.activity === "accreditation" && inMonth(r)), "accredited"),
      fsship_reaccreditation: sumField(rows.filter((r) => r.programme === "FSSHIP" && r.activity === "reaccreditation" && inMonth(r)), "reaccredited"),
      bhcpf_accreditation: sumField(rows.filter((r) => r.programme === "BHCPF" && r.activity === "accreditation" && inMonth(r)), "bhcpf_phcs_accredited"),
      bhcpf_reaccreditation: sumField(rows.filter((r) => r.programme === "BHCPF" && r.activity === "reaccreditation" && inMonth(r)), "bhcpf_phcs_reaccredited"),
    };
  });

  return {
    level,
    level_label: {
      1: "State Coordinator",
      2: "Zonal Director",
      3: "SDO / Headquarters",
      4: "Director-General",
    }[level] || "Provider Management",
    kpis: { ...kpis, ...programmeKpis },
    by_activity: byActivity,
    by_status: byStatus,
    by_state: byState,
    by_zone: byZone,
    by_month: byMonth,
    by_programme: byProgramme,
    pipeline_bars: pipelineBars,
    programme_activity_outputs: programmeActivityOutputs,
    exec_trend: execTrend,
    activity_analysis: buildActivityAnalysis(rows),
    action_queue: buildActionQueue(rows, level),
    priority_areas: buildPriorityAreas(rows),
    states_in_scope: new Set(rows.map((r) => r.state_id)).size,
    zones_in_scope: new Set(rows.map((r) => r.zone_id)).size,
    record_count: rows.length,
  };
}

function levelFromRole(role) {
  const r = String(role || "");
  if (r === "dg-ceo") return 4;
  if (r === "sdo" || r === "admin") return 3;
  if (r === "zonal-coordinator" || r === "zc" || r.endsWith("-zonal-coordinator")) return 2;
  if (r === "state-coordinator" || r.endsWith("-state-coordinator")) return 1;
  return 1;
}

const dashboard = async (req, res, next) => {
  try {
    const filters = {
      programme: req.query.programme,
      activity: req.query.activity,
      activity_status: req.query.activity_status,
    };
    const reports = await loadScopedReports(req.user, req.query);
    const rows = flattenActivities(reports, filters);
    const level = req.query.level ? Number(req.query.level) : levelFromRole(req.user?.role);
    const payload = buildPayload(rows, level);

    if (String(req.query.compare_with || "") === "previous") {
      const prevQuery = previousPeriodQuery(req.query);
      const prevReports = await loadScopedReports(req.user, prevQuery);
      const prevRows = flattenActivities(prevReports, filters);
      const prev = buildPayload(prevRows, level);
      const delta = (cur, old) => (cur == null || old == null ? null : Number(cur) - Number(old));
      payload.previous = {
        kpis: prev.kpis,
        year: prevQuery.year,
        month: prevQuery.month,
        quarter: prevQuery.quarter,
      };
      payload.kpis = {
        ...payload.kpis,
        fsship_accredited_delta: delta(payload.kpis.fsship_accredited, prev.kpis.fsship_accredited),
        fsship_reaccredited_delta: delta(payload.kpis.fsship_reaccredited, prev.kpis.fsship_reaccredited),
        bhcpf_phcs_accredited_delta: delta(payload.kpis.bhcpf_phcs_accredited, prev.kpis.bhcpf_phcs_accredited),
        bhcpf_phcs_reaccredited_delta: delta(payload.kpis.bhcpf_phcs_reaccredited, prev.kpis.bhcpf_phcs_reaccredited),
      };
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
};

module.exports = { dashboard, levelFromRole, ACTIVITY_KEYS, ACTIVITY_LABELS };
