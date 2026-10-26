/**
 * Provider Management dashboards — four levels on one activity register.
 * KPIs match the Provider Management Dashboards PPT (plan achievement,
 * facility coverage, activity completion, separate accreditation pipelines).
 */
const { Op } = require("sequelize");
const {
  AccreditationReport,
  AccreditationReportLine,
  StateOffice,
  ZonalOffice,
} = require("../models");
const { buildStateOfficeListWhere } = require("../utils/stateOfficeScope");

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

function parseTpl(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolvePeriod(query) {
  const year = query.year ? Number(query.year) : null;
  const month = query.month && query.month !== "all" ? Number(query.month) : null;
  const quarter = query.quarter && query.quarter !== "all" ? Number(query.quarter) : null;
  return { year, month, quarter };
}

function monthsForQuarter(q) {
  const start = (q - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

function activityKeyFromReport(report, tpl) {
  const fromTpl = String(tpl.form_type || "").trim();
  if (ACTIVITY_KEYS.includes(fromTpl)) return fromTpl;
  const mod = String(report.activity_module || "").trim();
  if (ACTIVITY_KEYS.includes(mod)) return mod;
  const cat = String(tpl.engagement_category || "").toLowerCase();
  if (cat.includes("re-accredit") || cat.includes("reaccredit")) return "reaccreditation";
  if (cat.includes("quality") || cat.includes("qa")) return "qa-inspections";
  if (cat.includes("medical") || cat.includes("audit")) return "medical-audits";
  if (cat.includes("accredit")) return "accreditation";
  return "accreditation";
}

function programmeOf(tpl) {
  if (tpl.related_programme) return String(tpl.related_programme);
  if (Array.isArray(tpl.programs_supported) && tpl.programs_supported[0]) {
    return String(tpl.programs_supported[0]);
  }
  return "Unspecified";
}

async function loadScopedReports(user, query) {
  const where = await buildStateOfficeListWhere(user, {
    zone_id: query.zone_id,
    state_id: query.state_id,
    year: query.year,
    month: query.month && query.month !== "all" ? query.month : undefined,
  });
  const { year, month, quarter } = resolvePeriod(query);
  if (year) where.reporting_year = year;
  if (month) where.reporting_month = month;
  else if (quarter && quarter >= 1 && quarter <= 4) {
    where.reporting_month = { [Op.in]: monthsForQuarter(quarter) };
  }

  return AccreditationReport.findAll({
    where,
    include: [
      { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
      { model: StateOffice, as: "state", attributes: ["id", "description"] },
      { model: AccreditationReportLine, as: "lines" },
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
    for (const line of report.lines || []) {
      const tpl = parseTpl(line.activity_template);
      const activity = activityKeyFromReport(report, tpl);
      const programme = programmeOf(tpl);
      const activityStatus = tpl.activity_status || "Unknown";
      if (programmeFilter && programme !== programmeFilter) continue;
      if (activityFilter && activity !== activityFilter) continue;
      if (statusFilter && activityStatus !== statusFilter) continue;

      const planned = num(tpl.facilities_planned ?? tpl.planned_target_stakeholders ?? line.secondary_count);
      const covered = num(tpl.facilities_covered ?? tpl.stakeholders_engaged ?? line.primary_count);
      const totalState = num(tpl.total_facilities_in_state);
      const awaitingAcc = num(
        tpl.metrics?.["Number of Facilities Awaiting Accreditation"]
        ?? tpl.metrics?.["Number of PHCs Awaiting Accreditation"]
        ?? 0,
      );
      const awaitingRe = num(
        tpl.metrics?.["Number of Facilities Awaiting Re-accreditation"]
        ?? tpl.metrics?.["Number of PHCs Awaiting Re-accreditation"]
        ?? 0,
      );
      const accredited = num(
        tpl.facilities_accredited
        ?? tpl.phcs_accredited
        ?? (activity === "accreditation" ? covered : 0),
      );
      const reaccredited = num(
        tpl.facilities_reaccredited
        ?? tpl.phcs_reaccredited
        ?? (activity === "reaccreditation" ? covered : 0),
      );
      const isBhcpf = programme === "BHCPF";

      rows.push({
        report_id: report.id,
        reference_id: report.reference_id,
        report_status: report.status,
        zone_id: report.zone_id,
        state_id: report.state_id,
        zone: report.zone?.description || `Zone ${report.zone_id}`,
        state: report.state?.description || `State ${report.state_id}`,
        year: report.reporting_year,
        month: report.reporting_month,
        activity,
        activity_label: ACTIVITY_LABELS[activity] || activity,
        programme,
        activity_status: activityStatus,
        planned,
        covered,
        total_state: totalState,
        awaiting_accreditation: activity === "accreditation" ? awaitingAcc : 0,
        awaiting_reaccreditation: activity === "reaccreditation" ? awaitingRe : 0,
        accredited: activity === "accreditation" ? (isBhcpf ? accredited || covered : accredited || covered) : 0,
        reaccredited: activity === "reaccreditation" ? (isBhcpf ? reaccredited || covered : reaccredited || covered) : 0,
        bhcpf_phcs_accredited: isBhcpf && activity === "accreditation" ? (accredited || covered) : 0,
        bhcpf_phcs_reaccredited: isBhcpf && activity === "reaccreditation" ? (reaccredited || covered) : 0,
        completed: COMPLETED_STATUSES.has(activityStatus),
      });
    }
  }
  return rows;
}

function sumField(rows, field) {
  return rows.reduce((s, r) => s + num(r[field]), 0);
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
      "Direct follow-up by programme and activity",
      "Request time-bound improvement plans from zones",
      "Monitor accreditation and reaccreditation separately",
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
        `Status and trend by state / period`,
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
      bhcpf_awaiting: sumField(subset.filter((r) => r.programme === "BHCPF"), "awaiting_accreditation"),
      bhcpf_awaiting_re: sumField(subset.filter((r) => r.programme === "BHCPF"), "awaiting_reaccreditation"),
      count: subset.length,
    };
    return {
      key: d.key,
      title: d.title,
      bullets: d.bullets(g),
      plan_achievement: d.rate(g),
      ...g,
    };
  });
}

function buildPriorityAreas(rows) {
  const byProgAct = groupSum(
    rows,
    (r) => `${r.programme} · ${r.activity_label}`,
    ["planned", "covered", "awaiting_accreditation", "awaiting_reaccreditation", "accredited", "reaccredited"],
  );
  return byProgAct
    .map((g) => {
      const rate = pct(g.covered, g.planned);
      let signal = "On track";
      let focus = "Maintain monitoring cadence";
      if ((g.awaiting_accreditation + g.awaiting_reaccreditation) > (g.accredited + g.reaccredited) * 1.2) {
        signal = "Pending high";
        focus = "Review pipeline by zone / state";
      } else if (rate != null && rate < 60) {
        signal = "Output below plan";
        focus = "Check visit plans and barriers";
      } else if (rate != null && rate < 75) {
        signal = "Uneven output";
        focus = "Target low-output areas";
      }
      return {
        area: g.label,
        signal,
        focus,
        plan_achievement: rate,
        awaiting: g.awaiting_accreditation + g.awaiting_reaccreditation,
        output: g.accredited + g.reaccredited,
      };
    })
    .sort((a, b) => (a.plan_achievement ?? 999) - (b.plan_achievement ?? 999))
    .slice(0, 8);
}

function buildPayload(rows, level) {
  const plannedFacilities = sumField(rows, "planned");
  const coveredFacilities = sumField(rows, "covered");
  const totalStateFacilities = sumField(rows, "total_state");
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

  const byMonth = groupSum(
    rows,
    (r) => `${r.year}-${String(r.month).padStart(2, "0")}`,
    ["planned", "covered", "accredited", "reaccredited", "bhcpf_phcs_accredited"],
  ).map((g) => {
    const [y, m] = g.label.split("-");
    const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", { month: "short" });
    return {
      period: g.label,
      label: monthLabel,
      planned: g.planned,
      covered: g.covered,
      completed: rows.filter((r) => `${r.year}-${String(r.month).padStart(2, "0")}` === g.label && r.completed).length,
      accredited: g.accredited,
      reaccredited: g.reaccredited,
      bhcpf_phcs_accredited: g.bhcpf_phcs_accredited,
    };
  }).sort((a, b) => a.period.localeCompare(b.period));

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
    bhcpf_phcs_accredited: sumField(bhcpf, "bhcpf_phcs_accredited") || sumField(bhcpf.filter((r) => r.activity === "accreditation"), "covered"),
    bhcpf_phcs_reaccredited: sumField(bhcpf, "bhcpf_phcs_reaccredited") || sumField(bhcpf.filter((r) => r.activity === "reaccreditation"), "covered"),
  };

  const pipelineBars = [
    { name: "Awaiting", value: kpis.awaiting_accreditation + kpis.awaiting_reaccreditation },
    { name: "Accredited", value: kpis.accredited + kpis.reaccredited },
    { name: "Planned", value: plannedFacilities },
    { name: "Covered", value: coveredFacilities },
  ];

  const programmeActivityOutputs = [
    { name: "FSSHIP Acc", value: sumField(fsship.filter((r) => r.activity === "accreditation"), "accredited") || sumField(fsship.filter((r) => r.activity === "accreditation"), "covered") },
    { name: "FSSHIP Re-acc", value: sumField(fsship.filter((r) => r.activity === "reaccreditation"), "reaccredited") || sumField(fsship.filter((r) => r.activity === "reaccreditation"), "covered") },
    { name: "BHCPF Acc", value: programmeKpis.bhcpf_phcs_accredited },
    { name: "BHCPF Re-acc", value: programmeKpis.bhcpf_phcs_reaccredited },
  ];

  const execTrend = byMonth.map((m) => ({
    label: m.label,
    period: m.period,
    fsship_accreditation: rows.filter((r) => r.programme === "FSSHIP" && r.activity === "accreditation" && `${r.year}-${String(r.month).padStart(2, "0")}` === m.period)
      .reduce((s, r) => s + (r.accredited || r.covered), 0),
    fsship_reaccreditation: rows.filter((r) => r.programme === "FSSHIP" && r.activity === "reaccreditation" && `${r.year}-${String(r.month).padStart(2, "0")}` === m.period)
      .reduce((s, r) => s + (r.reaccredited || r.covered), 0),
    bhcpf_accreditation: rows.filter((r) => r.programme === "BHCPF" && r.activity === "accreditation" && `${r.year}-${String(r.month).padStart(2, "0")}` === m.period)
      .reduce((s, r) => s + (r.bhcpf_phcs_accredited || r.covered), 0),
  }));

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
  if (r === "zonal-coordinator" || r.endsWith("-zonal-coordinator")) return 2;
  if (r === "state-coordinator" || r.endsWith("-state-coordinator")) return 1;
  return 1;
}

const dashboard = async (req, res, next) => {
  try {
    const reports = await loadScopedReports(req.user, req.query);
    const rows = flattenActivities(reports, {
      programme: req.query.programme,
      activity: req.query.activity,
      activity_status: req.query.activity_status,
    });
    const level = req.query.level ? Number(req.query.level) : levelFromRole(req.user?.role);
    const payload = buildPayload(rows, level);
    res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
};

module.exports = { dashboard, levelFromRole, ACTIVITY_KEYS, ACTIVITY_LABELS };
