const { Op } = require("sequelize");
const {
  EnrolmentReport, MigrationReport, CemoncReport,
  AccreditationReport, StakeholderReport, HmoSelectionReport, ChallengesReport,
  ComplaintsComplianceReport, IgrReport, SshiaFinancialReport, ExpenditureProfileReport,
  WeeklyActionableReport, ContractedServicesReport, MonitoringVisit,
  WeeklyActionableReportLine, ContractedServicesReportLine,
  StateOffice, ZonalOffice,
} = require("../models");
const { buildStateOfficeListWhere } = require("../utils/stateOfficeScope");
const { buildZoneBreakdown, buildStateBreakdownInZone } = require("../utils/dashboardDrillGeo");

/** Monthly state-office report models under SOC/Zones + Zonal + Finance */
const MONTHLY_REPORT_SOURCES = [
  { key: "weekly_actionable", label: "Weekly Actionable", model: WeeklyActionableReport },
  { key: "contracted_services", label: "Contracted Services", model: ContractedServicesReport },
  { key: "enrolment", label: "Enrolment", model: EnrolmentReport },
  { key: "migration", label: "Migration / Update Requests", model: MigrationReport },
  { key: "cemonc", label: "CEmONC & FFP Beneficiaries", model: CemoncReport },
  { key: "accreditation", label: "Accreditation / Reaccreditation", model: AccreditationReport },
  { key: "stakeholder", label: "Stakeholder Engagement", model: StakeholderReport },
  { key: "hmo_selection", label: "HMO Selection Process", model: HmoSelectionReport },
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
  ["weekly_actionable", "contracted_services"].includes(s.key),
);

/** Others module reports (complaints etc.) */
const OTHERS_REPORT_SOURCES = [
  { key: "complaints_report", label: "Complaints / Compliance Report", model: ComplaintsComplianceReport },
  ...MONTHLY_REPORT_SOURCES.filter((s) =>
    !["weekly_actionable", "contracted_services"].includes(s.key),
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
    where: { ...where, ...whereExtra },
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

const buildDashboardPayload = async (where) => {
  const reportStats = {};
  let totalReports = 0;
  let totalSubmitted = 0;
  let totalApproved = 0;
  const combinedMonthly = {};

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
  const visitStates = await MonitoringVisit.findAll({ where, attributes: ["state_id"], group: ["state_id"] });
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
      count += await MonitoringVisit.count({ where: stWhere });
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
  };
};

const dashboard = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const data = await buildDashboardPayload(where);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const applyMonthlyFilters = (where, query) => {
  const w = { ...where };
  if (query.status) w.status = query.status;
  if (query.month) {
    const [y, m] = String(query.month).split("-");
    if (y) w.reporting_year = y;
    if (m) w.reporting_month = Number(m);
  }
  return w;
};

const applyVisitFilters = (where, query, whereExtra = {}) => {
  const w = { ...where, ...whereExtra };
  if (query.status) w.status = query.status;
  if (query.month) w.visit_date = { [Op.like]: `${query.month}%` };
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

const mapMonthlyDrillRow = (r, src, geoInclude) => ({
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
  meta: `report_type:${src.key}`,
});

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
  meta: `report_type:${src.key}`,
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

      const visitCount = await MonitoringVisit.count({ where: stWhere });
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

      for (const src of MONTHLY_REPORT_SOURCES) {
        const rows = await src.model.findAll({
          where: applyMonthlyFilters(where, req.query),
          include: geoInclude,
          order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]],
          limit: 30,
        });
        rows.forEach((r) => combined.push(mapMonthlyDrillRow(r, src)));
      }

      const visits = await MonitoringVisit.findAll({
        where: applyVisitFilters(where, req.query),
        include: geoInclude,
        order: [["visit_date", "DESC"]],
        limit: 40,
      });
      visits.forEach((r) => {
        combined.push(mapVisitDrillRow(r, { key: "monitoring_visits", label: "Monitoring Visits" }));
      });

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
