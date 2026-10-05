const { Op } = require("sequelize");
const {
  EnrolmentReport, MigrationReport, CemoncReport,
  AccreditationReport, StakeholderReport, EnrolmentDriveReport, HmoSelectionReport, ChallengesReport,
  ComplaintsComplianceReport, IgrReport, SshiaFinancialReport, ExpenditureProfileReport,
  WeeklyActionableReport, ContractedServicesReport, MonitoringVisit,
  WeeklyActionableReportLine, ContractedServicesReportLine,
  MonthlyEnrolleeRegister, EtmcTmcActionPointRegister,
  ExtraDependantReport, HcpChangeReport,
  StateOffice, ZonalOffice,
} = require("../models");
const { buildStateOfficeListWhere } = require("../utils/stateOfficeScope");
const { buildZoneBreakdown, buildStateBreakdownInZone } = require("../utils/dashboardDrillGeo");

/** Monthly state-office report models under SOC/Zones + Zonal + Finance */
const MONTHLY_REPORT_SOURCES = [
  { key: "weekly_actionable", label: "Weekly Actionable", model: WeeklyActionableReport },
  { key: "contracted_services", label: "Contracted Services", model: ContractedServicesReport },
  { key: "enrollee_register", label: "Monthly Enrollee Register", model: MonthlyEnrolleeRegister },
  { key: "etmc_tmc_action_point", label: "ETMC/TMC Action-Point Register", model: EtmcTmcActionPointRegister },
  { key: "enrolment", label: "Enrolment", model: EnrolmentReport },
  { key: "migration", label: "Migration / Update Requests", model: MigrationReport },
  { key: "cemonc", label: "CEmONC & FFP Beneficiaries", model: CemoncReport },
  { key: "accreditation", label: "Accreditation / Reaccreditation", model: AccreditationReport },
  { key: "stakeholder", label: "Stakeholder Engagement", model: StakeholderReport },
  { key: "enrolment_drive", label: "Enrolment Drive", model: EnrolmentDriveReport },
  { key: "hmo_selection", label: "HMO Selection Process", model: HmoSelectionReport },
  { key: "extra_dependant", label: "Additional / Extra Dependant", model: ExtraDependantReport },
  { key: "hcf_change", label: "Change of HCF", model: HcpChangeReport },
  { key: "challenges", label: "Challenges & Recommendations", model: ChallengesReport },
  { key: "igr", label: "IGR", model: IgrReport },
  { key: "sshia_financial", label: "SSHIA Financial Report", model: SshiaFinancialReport },
  { key: "expenditure_profile", label: "Expenditure Profile", model: ExpenditureProfileReport },
];

/** Monitoring visit slices (disjoint — used for breakdown without double-counting totals) */
const MONITORING_VISIT_SOURCES = [
  {
    key: "monitoring_visits",
    label: "Monitoring Visits",
    whereExtra: {},
  },
  {
    key: "operation_monitoring",
    label: "Operation Monitoring Visit",
    whereExtra: { monitoring_type: { [Op.ne]: "spot_check" } },
  },
  {
    key: "spot_check",
    label: "Spot Check Visit",
    whereExtra: { monitoring_type: "spot_check" },
  },
];

/** Legacy export — SOC-only monthly subset */
const SOC_ZONES_REPORT_SOURCES = MONTHLY_REPORT_SOURCES.filter((s) =>
  ["weekly_actionable", "contracted_services", "enrollee_register", "etmc_tmc_action_point"].includes(s.key),
);

/** Others module reports (complaints etc.) */
const OTHERS_REPORT_SOURCES = [
  { key: "complaints_report", label: "Complaints / Compliance Report", model: ComplaintsComplianceReport },
  ...MONTHLY_REPORT_SOURCES.filter((s) =>
    !["weekly_actionable", "contracted_services", "enrollee_register", "etmc_tmc_action_point"].includes(s.key),
  ),
];

const REPORT_BY_KEY = Object.fromEntries([
  ...MONTHLY_REPORT_SOURCES.map((r) => [r.key, { ...r, kind: "monthly_report" }]),
  ...MONITORING_VISIT_SOURCES.map((r) => [r.key, { ...r, kind: "monitoring_visit" }]),
]);

const countByField = (rows, field) =>
  Object.entries(
    rows.reduce((acc, row) => {
      const k = row[field] || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ [field]: name, count }));

const monthKeyFromReport = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthKeyFromDate = (dateStr) => (dateStr ? String(dateStr).slice(0, 7) : null);

const bumpMonthly = (map, key, { total = 0, submitted = 0, approved = 0 } = {}) => {
  if (!key) return;
  if (!map[key]) map[key] = { month: key, reports: 0, submitted: 0, approved: 0 };
  map[key].reports += total;
  map[key].submitted += submitted;
  map[key].approved += approved;
};

const statusCounts = (rows) => {
  const submitted = rows.filter((r) => r.status === "submitted" || r.status === "reviewed").length;
  const approved = rows.filter((r) => r.status === "approved").length;
  return { submitted, approved };
};

const aggregateMonthlyReports = async (Model, where) => {
  const rows = await Model.findAll({
    where,
    attributes: ["id", "status", "reporting_year", "reporting_month", "state_id", "zone_id"],
  });
  const monthlyMap = {};
  rows.forEach((r) => {
    const key = monthKeyFromReport(r.reporting_year, r.reporting_month);
    const isSubmitted = r.status === "submitted";
    const isApproved = r.status === "approved";
    bumpMonthly(monthlyMap, key, {
      total: 1,
      submitted: isSubmitted ? 1 : 0,
      approved: isApproved ? 1 : 0,
    });
  });
  const { submitted, approved } = statusCounts(rows);
  return {
    total: rows.length,
    submitted,
    approved,
    by_status: countByField(rows, "status"),
    monthly: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
  };
};

const aggregateMonitoringVisits = async (where, whereExtra = {}) => {
  const rows = await MonitoringVisit.findAll({
    where: { ...toVisitWhere(where), ...whereExtra },
    attributes: ["id", "status", "visit_date", "state_id", "zone_id", "monitoring_type"],
  });
  const monthlyMap = {};
  rows.forEach((r) => {
    const key = monthKeyFromDate(r.visit_date);
    const isSubmitted = r.status === "submitted" || r.status === "reviewed";
    const isApproved = r.status === "approved";
    bumpMonthly(monthlyMap, key, {
      total: 1,
      submitted: isSubmitted ? 1 : 0,
      approved: isApproved ? 1 : 0,
    });
  });
  const { submitted, approved } = statusCounts(rows);
  return {
    total: rows.length,
    submitted,
    approved,
    by_status: countByField(rows, "status"),
    monthly: Object.values(monthlyMap).map((m) => ({
      month: m.month,
      total: m.reports,
      submitted: m.submitted,
      approved: m.approved,
    })).sort((a, b) => a.month.localeCompare(b.month)),
  };
};

const aggregateWeeklyActionableLines = async (where) => {
  const lines = await WeeklyActionableReportLine.findAll({
    attributes: ["status", "category"],
    include: [{
      model: WeeklyActionableReport,
      as: "report",
      where,
      attributes: [],
      required: true,
    }],
  });
  return {
    total_items: lines.length,
    by_status: countByField(lines, "status"),
    by_category: countByField(lines, "category"),
  };
};

const aggregateContractedServiceLines = async (where) => {
  const lines = await ContractedServicesReportLine.findAll({
    attributes: ["service", "amount"],
    include: [{
      model: ContractedServicesReport,
      as: "report",
      where,
      attributes: [],
      required: true,
    }],
  });
  const byService = {};
  let total_amount = 0;
  lines.forEach((line) => {
    const svc = line.service || "unknown";
    byService[svc] = (byService[svc] || 0) + 1;
    total_amount += Number(line.amount) || 0;
  });
  return {
    total_lines: lines.length,
    total_amount,
    by_service: Object.entries(byService).map(([service, count]) => ({ service, count })),
  };
};

const CLOSED_ACTIONABLE = new Set(["closed", "resolved", "completed", "done"]);
const OPEN_CHALLENGE = new Set(["in-progress", "escalated", "under review", "action initiated"]);

const periodLabel = (y, m) => {
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[m - 1] ?? m} ${y}`;
};

const shiftMonth = (y, m, delta) => {
  const d = new Date(y, m - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

/** Resolve reporting period from query (year + month, or month=YYYY-MM). Defaults to current month. */
const resolvePeriod = (query = {}) => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (query.year) year = Number(query.year) || year;
  if (query.month != null && query.month !== "") {
    const raw = String(query.month);
    if (raw.includes("-")) {
      const [y, m] = raw.split("-");
      if (y) year = Number(y) || year;
      if (m) month = Number(m) || month;
    } else {
      month = Number(raw) || month;
    }
  }
  month = Math.min(12, Math.max(1, month));
  return { year, month };
};

/**
 * monitoring_visits uses visit_date, not reporting_year/month.
 * Convert list-scope periods into a visit_date prefix filter.
 */
const toVisitWhere = (where = {}) => {
  const w = { ...where };
  const year = w.reporting_year;
  const month = w.reporting_month;
  delete w.reporting_year;
  delete w.reporting_month;
  // Prefer an explicit visit_date already set by applyVisitFilters
  if (w.visit_date) return w;
  if (year && month != null && month !== "") {
    w.visit_date = { [Op.like]: `${year}-${String(month).padStart(2, "0")}%` };
  } else if (year) {
    w.visit_date = { [Op.like]: `${year}-%` };
  }
  return w;
};

/** Count monthly reports matching an optional status filter within a year/month */
const countReportsInPeriod = async (where, year, month, statusFilter = null) => {
  const periodWhere = { ...where, reporting_year: year, reporting_month: month };
  if (statusFilter === "draft") periodWhere.status = "draft";
  else if (statusFilter === "submitted") periodWhere.status = { [Op.in]: ["submitted", "reviewed"] };
  else if (statusFilter === "approved") periodWhere.status = "approved";
  let total = 0;
  for (const src of MONTHLY_REPORT_SOURCES) {
    total += await src.model.count({ where: periodWhere });
  }
  return total;
};

/** Planned vs conducted from Enrolment Drive + Stakeholder (Activity Reporting templates) */
const aggregatePlanVsActual = async (where, year, month) => {
  const periodWhere = { ...where, reporting_year: year, reporting_month: month };
  let planned = 0;
  let conducted = 0;

  const driveReports = await EnrolmentDriveReport.findAll({
    where: periodWhere,
    attributes: ["id", "planned_activities"],
    include: [{ association: "lines", attributes: ["activity_status"] }],
  });
  driveReports.forEach((r) => {
    planned += Number(r.planned_activities) || 0;
    (r.lines || []).forEach((l) => {
      if (String(l.activity_status || "").toLowerCase() === "completed") conducted += 1;
    });
  });

  const stakeReports = await StakeholderReport.findAll({
    where: periodWhere,
    attributes: ["id", "planned_activities"],
    include: [{ association: "lines", attributes: ["activity_status"] }],
  });
  stakeReports.forEach((r) => {
    planned += Number(r.planned_activities) || 0;
    (r.lines || []).forEach((l) => {
      if (String(l.activity_status || "").toLowerCase() === "completed") conducted += 1;
    });
  });

  // If no planned figure was recorded, fall back to total activity lines as the plan base
  if (planned === 0) {
    const driveLines = driveReports.reduce((s, r) => s + (r.lines?.length || 0), 0);
    const stakeLines = stakeReports.reduce((s, r) => s + (r.lines?.length || 0), 0);
    planned = driveLines + stakeLines;
  }

  const rate = planned > 0 ? Math.round((conducted / planned) * 100) : (conducted > 0 ? 100 : 0);
  return { planned_activities: planned, activities_conducted: conducted, implementation_rate: rate };
};

const buildOperationalControl = async (where, combinedMonthly, actionableLines, period = null) => {
  const resolved = period || resolvePeriod();
  const cy = resolved.year;
  const cm = resolved.month;
  const prev = shiftMonth(cy, cm, -1);

  const [curTotal, curSubmitted, curApproved, curDrafts,
    prevTotal, prevSubmitted, prevApproved, prevDrafts] = await Promise.all([
    countReportsInPeriod(where, cy, cm),
    countReportsInPeriod(where, cy, cm, "submitted"),
    countReportsInPeriod(where, cy, cm, "approved"),
    countReportsInPeriod(where, cy, cm, "draft"),
    countReportsInPeriod(where, prev.year, prev.month),
    countReportsInPeriod(where, prev.year, prev.month, "submitted"),
    countReportsInPeriod(where, prev.year, prev.month, "approved"),
    countReportsInPeriod(where, prev.year, prev.month, "draft"),
  ]);

  const pct = (cur, prv) => {
    if (prv === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prv) / prv) * 100);
  };

  const curCompletion = curTotal > 0 ? Math.round((curApproved / curTotal) * 100) : 0;
  const prevCompletion = prevTotal > 0 ? Math.round((prevApproved / prevTotal) * 100) : 0;

  const periodWhere = { ...where, reporting_year: cy, reporting_month: cm };
  const [planActual, openChallenges] = await Promise.all([
    aggregatePlanVsActual(where, cy, cm),
    (async () => {
      try {
        const ChallengesReportLine = require("../models/ChallengesReportLine");
        const lines = await ChallengesReportLine.findAll({
          attributes: ["status"],
          include: [{
            model: ChallengesReport,
            as: "report",
            where: periodWhere,
            attributes: [],
            required: true,
          }],
        });
        return lines.filter((l) => {
          const s = String(l.status || "").toLowerCase();
          return !s || OPEN_CHALLENGE.has(s) || s === "in progress";
        }).length;
      } catch {
        return ChallengesReport.count({ where: periodWhere });
      }
    })(),
  ]);

  const openActionables = (actionableLines.by_status || [])
    .filter((r) => !CLOSED_ACTIONABLE.has(String(r.status || "").toLowerCase()))
    .reduce((s, r) => s + (Number(r.count) || 0), 0);

  const off_track = [];
  if (curDrafts > 0) {
    off_track.push({
      key: "drafts", label: "Draft reports not submitted", count: curDrafts,
      severity: curDrafts >= 5 ? "high" : "medium", reason: `Still in draft for ${periodLabel(cy, cm)}`,
    });
  }
  if (curSubmitted > 0) {
    off_track.push({
      key: "pending_review", label: "Awaiting your review", count: curSubmitted,
      severity: "high", reason: "Submitted reports need coordinator action",
    });
  }
  if (openActionables > 0) {
    off_track.push({
      key: "actionables", label: "Open weekly actionable items", count: openActionables,
      severity: openActionables >= 10 ? "high" : "medium", reason: "Unresolved escalated issues",
    });
  }
  if (planActual.planned_activities > 0 && planActual.implementation_rate < 70) {
    off_track.push({
      key: "implementation", label: "Activity implementation below 70%", count: planActual.implementation_rate,
      severity: planActual.implementation_rate < 50 ? "high" : "medium",
      reason: `${planActual.activities_conducted} of ${planActual.planned_activities} planned activities completed`,
    });
  }
  if (openChallenges > 0) {
    off_track.push({
      key: "challenges", label: "Open challenges", count: openChallenges,
      severity: "medium", reason: "Challenges still open / in progress",
    });
  }

  // Build 6-month trend from combined monthly (pad if needed)
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const p = shiftMonth(cy, cm, -i);
    const key = monthKeyFromReport(p.year, p.month);
    const row = combinedMonthly[key] || { month: key, reports: 0, submitted: 0, approved: 0 };
    trend.push({
      month: key,
      label: periodLabel(p.year, p.month).split(" ")[0],
      reports: row.reports || 0,
      submitted: row.submitted || 0,
      approved: row.approved || 0,
    });
  }

  return {
    current_period: { year: cy, month: cm, label: periodLabel(cy, cm) },
    previous_period: { year: prev.year, month: prev.month, label: periodLabel(prev.year, prev.month) },
    current: {
      reports: curTotal, submitted: curSubmitted, approved: curApproved, drafts: curDrafts,
      completion_rate: curCompletion,
    },
    previous: {
      reports: prevTotal, submitted: prevSubmitted, approved: prevApproved, drafts: prevDrafts,
      completion_rate: prevCompletion,
    },
    vs_previous: {
      reports_delta_pct: pct(curTotal, prevTotal),
      submitted_delta_pct: pct(curSubmitted, prevSubmitted),
      approved_delta_pct: pct(curApproved, prevApproved),
      completion_delta_pp: curCompletion - prevCompletion,
    },
    planned_activities: planActual.planned_activities,
    activities_conducted: planActual.activities_conducted,
    implementation_rate: planActual.implementation_rate,
    needs_action: {
      pending_review: curSubmitted,
      open_actionables: openActionables,
      draft_reports: curDrafts,
      open_challenges: openChallenges,
      total: curSubmitted + openActionables + curDrafts + openChallenges,
    },
    off_track,
    period_trend: trend,
  };
};

/** Per-state comparative metrics for zonal oversight */
const buildComparativeOversight = async (where, operational) => {
  const cy = operational.current_period.year;
  const cm = operational.current_period.month;

  // Prefer all states in the scoped zone; fall back to states present in where
  let states = [];
  if (where.zone_id) {
    states = await StateOffice.findAll({
      where: { zonal_id: where.zone_id },
      attributes: ["id", "description"],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "description"] }],
      order: [["description", "ASC"]],
    });
  } else if (where.state_id) {
    states = await StateOffice.findAll({
      where: { id: where.state_id },
      attributes: ["id", "description"],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "description"] }],
    });
  } else {
    states = await StateOffice.findAll({
      attributes: ["id", "description"],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "description"] }],
      order: [["description", "ASC"]],
    });
  }

  // One row per state — never inflate state counts with duplicate office records
  const seenStateIds = new Set();
  states = states.filter((st) => {
    if (seenStateIds.has(st.id)) return false;
    seenStateIds.add(st.id);
    return true;
  });

  const state_rows = await Promise.all(states.map(async (st) => {
    const stWhere = { ...where, state_id: st.id };
    if (st.zone?.id) stWhere.zone_id = st.zone.id;
    const [reports, submitted, approved, drafts, planActual, openActionables, openChallenges] = await Promise.all([
      countReportsInPeriod(stWhere, cy, cm),
      countReportsInPeriod(stWhere, cy, cm, "submitted"),
      countReportsInPeriod(stWhere, cy, cm, "approved"),
      countReportsInPeriod(stWhere, cy, cm, "draft"),
      aggregatePlanVsActual(stWhere, cy, cm),
      (async () => {
        const lines = await aggregateWeeklyActionableLines(stWhere);
        const open = (lines.by_status || [])
          .filter((r) => !CLOSED_ACTIONABLE.has(String(r.status || "").toLowerCase()))
          .reduce((s, r) => s + (Number(r.count) || 0), 0);
        const escalated = (lines.by_status || [])
          .filter((r) => String(r.status || "").toLowerCase() === "escalated")
          .reduce((s, r) => s + (Number(r.count) || 0), 0);
        return { open, escalated, by_status: lines.by_status || [] };
      })(),
      (async () => {
        try {
          const ChallengesReportLine = require("../models/ChallengesReportLine");
          const lines = await ChallengesReportLine.findAll({
            attributes: ["status", "challenge_category", "support_required", "responsible_department"],
            include: [{
              model: ChallengesReport, as: "report", where: stWhere, attributes: [], required: true,
            }],
          });
          const openLines = lines.filter((l) => {
            const s = String(l.status || "").toLowerCase();
            return !s || OPEN_CHALLENGE.has(s) || s === "in progress" || s === "escalated";
          });
          return {
            open: openLines.length,
            categories: lines.map((l) => l.challenge_category).filter(Boolean),
            support: openLines.map((l) => l.support_required).filter(Boolean),
            departments: openLines.map((l) => l.responsible_department).filter(Boolean),
          };
        } catch {
          const n = await ChallengesReport.count({ where: stWhere });
          return { open: n, categories: [], support: [], departments: [] };
        }
      })(),
    ]);

    const completion_rate = reports > 0 ? Math.round((approved / reports) * 100) : 0;
    const intervention_score =
      (drafts * 2) + (submitted * 3) + (openActionables.open * 2) + (openChallenges.open * 2)
      + (openActionables.escalated * 4)
      + (planActual.implementation_rate < 70 && planActual.planned_activities > 0 ? 5 : 0)
      + (reports === 0 ? 4 : 0);

    let band = "performing";
    if (reports === 0 || completion_rate < 50 || intervention_score >= 12) band = "needs_intervention";
    else if (completion_rate < 75 || planActual.implementation_rate < 70 || openActionables.open > 0 || drafts > 2) band = "lagging";

    return {
      state_id: st.id,
      state_name: st.description,
      zone_id: st.zone?.id ?? null,
      zone_name: st.zone?.description ?? null,
      reports,
      submitted,
      approved,
      drafts,
      completion_rate,
      planned_activities: planActual.planned_activities,
      activities_conducted: planActual.activities_conducted,
      implementation_rate: planActual.implementation_rate,
      open_actionables: openActionables.open,
      escalated_actionables: openActionables.escalated,
      open_challenges: openChallenges.open,
      challenge_categories: openChallenges.categories,
      support_required: openChallenges.support,
      responsible_departments: openChallenges.departments,
      intervention_score,
      band,
    };
  }));

  state_rows.sort((a, b) => b.completion_rate - a.completion_rate || b.reports - a.reports);

  const performing = state_rows.filter((s) => s.band === "performing");
  const lagging = state_rows.filter((s) => s.band === "lagging");
  const needs_intervention = state_rows.filter((s) => s.band === "needs_intervention")
    .sort((a, b) => b.intervention_score - a.intervention_score);

  // Regional patterns — recurring challenge categories & actionable statuses across states
  const challengeFreq = {};
  const problemFreq = {};
  const supportFreq = {};
  const deptFreq = {};
  state_rows.forEach((s) => {
    (s.challenge_categories || []).forEach((c) => {
      challengeFreq[c] = (challengeFreq[c] || 0) + 1;
    });
    (s.support_required || []).forEach((c) => {
      supportFreq[c] = (supportFreq[c] || 0) + 1;
    });
    (s.responsible_departments || []).forEach((c) => {
      deptFreq[c] = (deptFreq[c] || 0) + 1;
    });
    if (s.drafts > 0) problemFreq.draft_backlog = (problemFreq.draft_backlog || 0) + 1;
    if (s.submitted > 0) problemFreq.pending_review = (problemFreq.pending_review || 0) + 1;
    if (s.open_actionables > 0) problemFreq.open_actionables = (problemFreq.open_actionables || 0) + 1;
    if (s.escalated_actionables > 0) problemFreq.escalated_actionables = (problemFreq.escalated_actionables || 0) + 1;
    if (s.implementation_rate < 70 && s.planned_activities > 0) {
      problemFreq.low_implementation = (problemFreq.low_implementation || 0) + 1;
    }
    if (s.reports === 0) problemFreq.no_reports = (problemFreq.no_reports || 0) + 1;
  });

  const PROBLEM_LABELS = {
    draft_backlog: "Draft backlog",
    pending_review: "Pending review",
    open_actionables: "Open actionables",
    escalated_actionables: "Escalated actionables",
    low_implementation: "Low implementation vs plan",
    no_reports: "No reports this month",
  };

  const recurring_problems = Object.entries(problemFreq)
    .map(([key, states_affected]) => ({
      key,
      label: PROBLEM_LABELS[key] || key,
      states_affected,
    }))
    .sort((a, b) => b.states_affected - a.states_affected);

  const challenge_patterns = Object.entries(challengeFreq)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const support_requirements = Object.entries(supportFreq)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const department_load = Object.entries(deptFreq)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Zone rollup for national / multi-zone views
  const zoneMap = {};
  state_rows.forEach((s) => {
    const zid = s.zone_id || "unknown";
    if (!zoneMap[zid]) {
      zoneMap[zid] = {
        zone_id: s.zone_id,
        zone_name: s.zone_name || "Unassigned",
        states: 0,
        reports: 0,
        submitted: 0,
        approved: 0,
        drafts: 0,
        open_actionables: 0,
        escalated_actionables: 0,
        open_challenges: 0,
        completion_sum: 0,
        implementation_sum: 0,
        performing: 0,
        lagging: 0,
        needs_intervention: 0,
      };
    }
    const z = zoneMap[zid];
    z.states += 1;
    z.reports += s.reports;
    z.submitted += s.submitted;
    z.approved += s.approved;
    z.drafts += s.drafts;
    z.open_actionables += s.open_actionables;
    z.escalated_actionables += s.escalated_actionables;
    z.open_challenges += s.open_challenges;
    z.completion_sum += s.completion_rate;
    z.implementation_sum += s.implementation_rate;
    if (s.band === "performing") z.performing += 1;
    else if (s.band === "lagging") z.lagging += 1;
    else z.needs_intervention += 1;
  });

  const zones = Object.values(zoneMap).map((z) => ({
    zone_id: z.zone_id,
    zone_name: z.zone_name,
    states: z.states,
    reports: z.reports,
    submitted: z.submitted,
    approved: z.approved,
    drafts: z.drafts,
    open_actionables: z.open_actionables,
    escalated_actionables: z.escalated_actionables,
    open_challenges: z.open_challenges,
    completion_rate: z.states ? Math.round(z.completion_sum / z.states) : 0,
    implementation_rate: z.states ? Math.round(z.implementation_sum / z.states) : 0,
    performing: z.performing,
    lagging: z.lagging,
    needs_intervention: z.needs_intervention,
    compliance_rate: z.reports > 0 ? Math.round((z.approved / z.reports) * 100) : 0,
  })).sort((a, b) => b.completion_rate - a.completion_rate);

  // Escalation queue — one entry per state (merge reasons so state count stays unique)
  const escalationByState = new Map();
  state_rows.forEach((s) => {
    const reasons = [];
    let tier = "sdo";
    let count = 0;
    if (s.escalated_actionables > 0) {
      reasons.push(`${s.escalated_actionables} escalated actionable(s)`);
      tier = "dg";
      count += s.escalated_actionables;
    }
    if (s.open_challenges > 0) {
      const depts = (s.responsible_departments || []).slice(0, 2).join(", ");
      reasons.push(depts ? `Challenges → ${depts}` : `${s.open_challenges} open challenge(s)`);
      if (tier !== "dg") tier = "department";
      count += s.open_challenges;
    }
    if (s.band === "needs_intervention") {
      reasons.push(s.reports === 0 ? "No reporting this month" : "Needs coordination support");
      count += s.intervention_score;
    }
    if (!reasons.length) return;
    escalationByState.set(s.state_id, {
      tier,
      state_id: s.state_id,
      state_name: s.state_name,
      zone_name: s.zone_name,
      zone_id: s.zone_id,
      label: reasons[0],
      count,
      reason: reasons.join(" · "),
      meta: `state:${s.state_id}`,
    });
  });
  const escalations = [...escalationByState.values()].sort((a, b) => {
    const tierOrder = { dg: 0, department: 1, sdo: 2 };
    return (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9) || b.count - a.count;
  });

  const zone_avg_completion = state_rows.length
    ? Math.round(state_rows.reduce((s, r) => s + r.completion_rate, 0) / state_rows.length)
    : 0;
  const zone_avg_implementation = state_rows.length
    ? Math.round(state_rows.reduce((s, r) => s + r.implementation_rate, 0) / state_rows.length)
    : 0;

  return {
    period: operational.current_period,
    previous_period: operational.previous_period,
    states: state_rows,
    zones,
    performing,
    lagging,
    needs_intervention,
    summary: {
      states_total: state_rows.length,
      zones_total: zones.length,
      performing: performing.length,
      lagging: lagging.length,
      needs_intervention: needs_intervention.length,
      zone_avg_completion,
      zone_avg_implementation,
      national_avg_completion: zone_avg_completion,
      national_avg_implementation: zone_avg_implementation,
      escalations_total: escalations.length,
      escalated_actionables: state_rows.reduce((s, r) => s + (r.escalated_actionables || 0), 0),
    },
    recurring_problems,
    challenge_patterns,
    support_requirements,
    department_load,
    escalations,
    top_states: state_rows.slice(0, 8),
    bottom_states: [...state_rows].reverse().slice(0, 8),
    intervention_states: needs_intervention.map((s) => ({
      id: s.state_id,
      title: s.state_name,
      subtitle: s.zone_name || "Needs support",
      status: `${s.completion_rate}%`,
      zone_name: s.zone_name,
      state_name: s.state_name,
      state_id: s.state_id,
      zone_id: s.zone_id,
      meta: `state:${s.state_id}`,
      reference: null,
      date: null,
    })),
  };
};

const buildDashboardPayload = async (where, period = null) => {
  const reportStats = {};
  let totalReports = 0;
  let totalSubmitted = 0;
  let totalApproved = 0;
  const combinedMonthly = {};
  const resolvedPeriod = period || resolvePeriod();

  for (const src of MONTHLY_REPORT_SOURCES) {
    const stats = await aggregateMonthlyReports(src.model, where);
    reportStats[src.key] = { label: src.label, kind: "monthly_report", ...stats };
    totalReports += stats.total;
    totalSubmitted += stats.submitted;
    totalApproved += stats.approved;
    stats.monthly.forEach((m) => {
      bumpMonthly(combinedMonthly, m.month, {
        total: m.total,
        submitted: m.submitted,
        approved: m.approved,
      });
    });
  }

  // Visits: count operation + spot_check once each (partition of all visits)
  for (const src of MONITORING_VISIT_SOURCES.filter((s) => s.key !== "monitoring_visits")) {
    const stats = await aggregateMonitoringVisits(where, src.whereExtra);
    reportStats[src.key] = { label: src.label, kind: "monitoring_visit", ...stats };
    totalReports += stats.total;
    totalSubmitted += stats.submitted;
    totalApproved += stats.approved;
    stats.monthly.forEach((m) => {
      bumpMonthly(combinedMonthly, m.month, {
        total: m.total,
        submitted: m.submitted,
        approved: m.approved,
      });
    });
  }

  // All monitoring visits stat for zonal drill (not added to total — subset of operation+spot)
  const allVisits = await aggregateMonitoringVisits(where, {});
  reportStats.monitoring_visits = {
    label: "Monitoring Visits",
    kind: "monitoring_visit",
    ...allVisits,
  };

  const stateIds = new Set();
  for (const src of MONTHLY_REPORT_SOURCES) {
    const rows = await src.model.findAll({ where, attributes: ["state_id"], group: ["state_id"] });
    rows.forEach((r) => { if (r.state_id) stateIds.add(r.state_id); });
  }
  const visitStates = await MonitoringVisit.findAll({ where: toVisitWhere(where), attributes: ["state_id"], group: ["state_id"] });
  visitStates.forEach((r) => { if (r.state_id) stateIds.add(r.state_id); });

  const stateRows = stateIds.size
    ? await StateOffice.findAll({
      where: { id: { [Op.in]: [...stateIds] } },
      attributes: ["id", "description"],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["description"] }],
    })
    : [];

  const state_activity = await Promise.all(
    stateRows.map(async (st) => {
      const stWhere = { ...where, state_id: st.id };
      let count = 0;
      for (const src of MONTHLY_REPORT_SOURCES) {
        count += await src.model.count({ where: stWhere });
      }
      count += await MonitoringVisit.count({ where: toVisitWhere(stWhere) });
      return {
        state_id: st.id,
        state_name: st.description,
        zone_name: st.zone?.description ?? null,
        report_count: count,
      };
    }),
  );
  state_activity.sort((a, b) => b.report_count - a.report_count);

  const reportsByType = Object.entries(reportStats)
    .map(([key, v]) => ({
      key,
      label: v.label,
      total: v.total,
      by_status: v.by_status,
    }))
    .filter((r) => r.total > 0 && r.key !== "monitoring_visits")
    .sort((a, b) => b.total - a.total);

  const actionableLines = await aggregateWeeklyActionableLines(where);
  const contractedLines = await aggregateContractedServiceLines(where);
  const operational = await buildOperationalControl(where, combinedMonthly, actionableLines, resolvedPeriod);
  const comparative = await buildComparativeOversight(where, operational);

  return {
    total_reports: totalReports,
    total_submitted: totalSubmitted,
    total_approved: totalApproved,
    report_types_active: reportsByType.length,
    reports_by_type: reportsByType,
    monthly_activity: Object.values(combinedMonthly).sort((a, b) => a.month.localeCompare(b.month)),
    state_activity: state_activity.slice(0, 15),
    weekly_actionable_reports: reportStats.weekly_actionable?.total ?? 0,
    contracted_services_reports: reportStats.contracted_services?.total ?? 0,
    operation_monitoring_visits: reportStats.operation_monitoring?.total ?? 0,
    spot_check_visits: reportStats.spot_check?.total ?? 0,
    monitoring_visits: reportStats.monitoring_visits?.total ?? 0,
    weekly_actionable_items: actionableLines.total_items,
    actionable_by_status: actionableLines.by_status,
    actionable_by_category: actionableLines.by_category,
    contracted_service_lines: contractedLines.total_lines,
    contracted_total_amount: contractedLines.total_amount,
    contracted_by_service: contractedLines.by_service,
    operational,
    comparative,
  };
};

const dashboard = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const period = resolvePeriod(req.query);
    const data = await buildDashboardPayload(where, period);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const applyMonthlyFilters = (where, query) => {
  const w = { ...where };
  if (query.status === "submitted") {
    w.status = { [Op.in]: ["submitted", "reviewed"] };
  } else if (query.status) {
    w.status = query.status;
  }
  if (query.month) {
    const [y, m] = String(query.month).split("-");
    if (y) w.reporting_year = y;
    if (m) w.reporting_month = Number(m);
  }
  return w;
};

const applyVisitFilters = (where, query, whereExtra = {}) => {
  const w = toVisitWhere({ ...where, ...whereExtra });
  if (query.status) w.status = query.status;
  if (query.month) {
    // Drill sends month as YYYY-MM (or YYYY)
    w.visit_date = { [Op.like]: `${query.month}%` };
  }
  return w;
};

const countSocDrillRecord = async (user, query, recordSegment) => {
  const scoped = await buildStateOfficeListWhere(user, query);

  if (recordSegment === "reports" && query.report_type) {
    const src = REPORT_BY_KEY[query.report_type];
    if (!src) return 0;
    if (src.kind === "monitoring_visit") {
      return MonitoringVisit.count({ where: applyVisitFilters(scoped, query, src.whereExtra) });
    }
    return src.model.count({ where: applyMonthlyFilters(scoped, query) });
  }

  let total = 0;
  for (const src of MONTHLY_REPORT_SOURCES) {
    total += await src.model.count({ where: applyMonthlyFilters(scoped, query) });
  }
  total += await MonitoringVisit.count({ where: applyVisitFilters(scoped, query) });
  return total;
};

const mapMonthlyDrillRow = (r, src) => {
  const driveSuffix = src.key === "enrolment_drive" && r.drive_type ? `:${r.drive_type}` : "";
  return {
    id: `${src.key}-${r.id}`,
    reference: r.reference_id,
    title: src.label,
    subtitle: src.key === "weekly_actionable"
      ? `${r.reporting_year}-W${r.reporting_week ?? 1} (${String(r.reporting_month).padStart(2, "0")})`
      : `${r.reporting_year}-${String(r.reporting_month).padStart(2, "0")}`,
    status: r.status,
    date: r.submission_date,
    state_name: r.state?.description ?? null,
    zone_name: r.zone?.description ?? null,
    state_id: r.state_id ?? r.state?.id ?? null,
    zone_id: r.zone_id ?? r.zone?.id ?? null,
    meta: `record:${src.key}:${r.id}${driveSuffix}`,
  };
};

const mapVisitDrillRow = (r, src) => ({
  id: `${src.key}-${r.id}`,
  reference: r.reference_id,
  title: src.label,
  subtitle: [r.facility_name, r.monitoring_type].filter(Boolean).join(" · "),
  status: r.status,
  date: r.visit_date,
  state_name: r.state?.description ?? null,
  zone_name: r.zone?.description ?? null,
  state_id: r.state_id ?? r.state?.id ?? null,
  zone_id: r.zone_id ?? r.zone?.id ?? null,
  meta: `record:${src.key}:${r.id}`,
});

const dashboardDrill = async (req, res, next) => {
  try {
    const segment = String(req.query.segment || "reports");
    const recordSegment = req.query.record_segment || "all_reports";
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const geoInclude = [
      { model: StateOffice, as: "state", attributes: ["description"] },
      { model: ZonalOffice, as: "zone", attributes: ["description"] },
    ];

    if (segment === "zone_breakdown") {
      const data = await buildZoneBreakdown((zoneId) =>
        countSocDrillRecord(req.user, { ...req.query, zone_id: String(zoneId) }, recordSegment),
      );
      return res.json({ success: true, data });
    }

    if (segment === "state_breakdown") {
      const stateId = req.query.state_id;
      const zoneId = req.query.zone_id;
      if (!stateId && zoneId) {
        const data = await buildStateBreakdownInZone(zoneId, (stId) =>
          countSocDrillRecord(req.user, { ...req.query, zone_id: String(zoneId), state_id: String(stId) }, recordSegment),
        );
        return res.json({ success: true, data });
      }
      if (!stateId) {
        return res.status(422).json({ success: false, message: "state_id or zone_id required" });
      }

      const stWhere = { ...where, state_id: stateId };
      const breakdown = [];

      for (const src of MONTHLY_REPORT_SOURCES) {
        const count = await src.model.count({ where: stWhere });
        if (count > 0) {
          breakdown.push({
            id: src.key,
            reference: null,
            title: src.label,
            subtitle: "SOC/Zones report",
            status: String(count),
            meta: `report_type:${src.key}`,
          });
        }
      }

      const visitCount = await MonitoringVisit.count({ where: toVisitWhere(stWhere) });
      if (visitCount > 0) {
        breakdown.push({
          id: "monitoring_visits",
          reference: null,
          title: "Monitoring Visits",
          subtitle: "SOC/Zones monitoring",
          status: String(visitCount),
          meta: "report_type:monitoring_visits",
        });
      }

      const state = await StateOffice.findByPk(stateId, {
        attributes: ["description"],
        include: [{ model: ZonalOffice, as: "zone", attributes: ["description"] }],
      });
      breakdown.forEach((b) => {
        b.state_name = state?.description;
        b.zone_name = state?.zone?.description ?? null;
      });
      return res.json({ success: true, data: breakdown });
    }

    if (segment === "all_reports") {
      const combined = [];
      const typeFilter = req.query.report_type ? REPORT_BY_KEY[req.query.report_type] : null;
      const monthlySources = typeFilter && typeFilter.kind === "monthly_report"
        ? [typeFilter]
        : typeFilter
          ? []
          : MONTHLY_REPORT_SOURCES;

      for (const src of monthlySources) {
        const rows = await src.model.findAll({
          where: applyMonthlyFilters(where, req.query),
          include: geoInclude,
          order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]],
          limit: typeFilter ? 200 : 30,
        });
        rows.forEach((r) => combined.push(mapMonthlyDrillRow(r, src)));
      }

      if (!typeFilter || typeFilter.kind === "monitoring_visit") {
        const visitWhere = typeFilter?.whereExtra
          ? applyVisitFilters(where, req.query, typeFilter.whereExtra)
          : applyVisitFilters(where, req.query);
        const visits = await MonitoringVisit.findAll({
          where: visitWhere,
          include: geoInclude,
          order: [["visit_date", "DESC"]],
          limit: typeFilter ? 200 : 40,
        });
        const visitLabel = typeFilter?.label ?? "Monitoring Visits";
        const visitKey = typeFilter?.key ?? "monitoring_visits";
        visits.forEach((r) => {
          combined.push(mapVisitDrillRow(r, { key: visitKey, label: visitLabel }));
        });
      }

      combined.sort((a, b) => String(b.date || b.subtitle).localeCompare(String(a.date || a.subtitle)));
      return res.json({ success: true, data: combined.slice(0, 200) });
    }

    const reportKey = req.query.report_type;
    const src = reportKey ? REPORT_BY_KEY[reportKey] : null;
    if (!src) {
      return res.status(422).json({
        success: false,
        message: "report_type required",
      });
    }

    if (src.kind === "monitoring_visit") {
      const rows = await MonitoringVisit.findAll({
        where: applyVisitFilters(where, req.query, src.whereExtra),
        include: geoInclude,
        order: [["visit_date", "DESC"]],
        limit: 200,
      });
      return res.json({
        success: true,
        data: rows.map((r) => mapVisitDrillRow(r, src)),
      });
    }

    const rows = await src.model.findAll({
      where: applyMonthlyFilters(where, req.query),
      include: geoInclude,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]],
      limit: 200,
    });
    return res.json({
      success: true,
      data: rows.map((r) => mapMonthlyDrillRow(r, src)),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  dashboard,
  dashboardDrill,
  SOC_ZONES_REPORT_SOURCES,
  OTHERS_REPORT_SOURCES,
  MONTHLY_REPORT_SOURCES,
  MONITORING_VISIT_SOURCES,
};
