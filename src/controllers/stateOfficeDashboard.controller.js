const { Op } = require("sequelize");
const {
  EnrolmentReport, MigrationReport, CemoncReport,
  AccreditationReport, StakeholderReport, HmoSelectionReport, ChallengesReport,
  ComplaintsComplianceReport, IgrReport, SshiaFinancialReport, ExpenditureProfileReport,
  WeeklyActionableReport, ContractedServicesReport,
  WeeklyActionableReportLine, ContractedServicesReportLine,
  StateOffice, ZonalOffice,
} = require("../models");
const { buildStateOfficeListWhere } = require("../utils/stateOfficeScope");
const { buildZoneBreakdown, buildStateBreakdownInZone } = require("../utils/dashboardDrillGeo");

/** SOC/Zones sidebar — unit dashboard aggregates these only */
const SOC_ZONES_REPORT_SOURCES = [
  { key: "weekly_actionable", label: "Weekly Actionable", model: WeeklyActionableReport },
  { key: "contracted_services", label: "Contracted Services", model: ContractedServicesReport },
];

/** Others module reports (for a future Others dashboard) */
const OTHERS_REPORT_SOURCES = [
  { key: "enrolment", label: "Enrolment", model: EnrolmentReport },
  { key: "migration", label: "Migration / Update Requests", model: MigrationReport },
  { key: "cemonc", label: "CEmONC & FFP Beneficiaries", model: CemoncReport },
  { key: "accreditation", label: "Accreditation / Reaccreditation", model: AccreditationReport },
  { key: "stakeholder", label: "Stakeholder Engagement", model: StakeholderReport },
  { key: "hmo_selection", label: "HMO Selection Process", model: HmoSelectionReport },
  { key: "challenges", label: "Challenges & Recommendations", model: ChallengesReport },
  { key: "complaints_report", label: "Complaints / Compliance Report", model: ComplaintsComplianceReport },
  { key: "igr", label: "IGR", model: IgrReport },
  { key: "sshia_financial", label: "SSHIA Financial Report", model: SshiaFinancialReport },
  { key: "expenditure_profile", label: "Expenditure Profile", model: ExpenditureProfileReport },
];

const REPORT_SOURCES = [...SOC_ZONES_REPORT_SOURCES, ...OTHERS_REPORT_SOURCES];

const countByField = (rows, field) =>
  Object.entries(
    rows.reduce((acc, row) => {
      const k = row[field] || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ [field]: name, count }));

const aggregateReports = async (Model, where) => {
  const rows = await Model.findAll({
    where,
    attributes: ["id", "status", "reporting_year", "reporting_month", "state_id", "zone_id"],
  });
  const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
  const monthlyMap = {};
  rows.forEach((r) => {
    const key = monthKey(r.reporting_year, r.reporting_month);
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, total: 0, submitted: 0, approved: 0 };
    monthlyMap[key].total += 1;
    if (r.status === "submitted") monthlyMap[key].submitted += 1;
    if (r.status === "approved") monthlyMap[key].approved += 1;
  });
  return {
    total: rows.length,
    by_status: countByField(rows, "status"),
    monthly: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
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

const buildDashboardPayload = async (sources, where, { includeLineStats = false } = {}) => {
  const reportStats = {};
  let totalReports = 0;
  let totalSubmitted = 0;
  let totalApproved = 0;
  const combinedMonthly = {};

  for (const src of sources) {
    const stats = await aggregateReports(src.model, where);
    reportStats[src.key] = { label: src.label, ...stats };
    totalReports += stats.total;
    totalSubmitted += stats.by_status.find((s) => s.status === "submitted")?.count ?? 0;
    totalApproved += stats.by_status.find((s) => s.status === "approved")?.count ?? 0;
    stats.monthly.forEach((m) => {
      if (!combinedMonthly[m.month]) {
        combinedMonthly[m.month] = { month: m.month, reports: 0, submitted: 0, approved: 0 };
      }
      combinedMonthly[m.month].reports += m.total;
      combinedMonthly[m.month].submitted += m.submitted;
      combinedMonthly[m.month].approved += m.approved;
    });
  }

  const stateIds = new Set();
  for (const src of sources) {
    const rows = await src.model.findAll({ where, attributes: ["state_id"], group: ["state_id"] });
    rows.forEach((r) => { if (r.state_id) stateIds.add(r.state_id); });
  }

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
      for (const src of sources) {
        count += await src.model.count({ where: stWhere });
      }
      return {
        state_id: st.id,
        state_name: st.description,
        zone_name: st.zone?.description ?? null,
        report_count: count,
      };
    }),
  );
  state_activity.sort((a, b) => b.report_count - a.report_count);

  const payload = {
    total_reports: totalReports,
    total_submitted: totalSubmitted,
    total_approved: totalApproved,
    report_types_active: Object.values(reportStats).filter((r) => r.total > 0).length,
    reports_by_type: Object.entries(reportStats).map(([key, v]) => ({
      key,
      label: v.label,
      total: v.total,
      by_status: v.by_status,
    })).filter((r) => r.total > 0).sort((a, b) => b.total - a.total),
    monthly_activity: Object.values(combinedMonthly).sort((a, b) => a.month.localeCompare(b.month)),
    state_activity: state_activity.slice(0, 15),
    weekly_actionable_reports: reportStats.weekly_actionable?.total ?? 0,
    contracted_services_reports: reportStats.contracted_services?.total ?? 0,
  };

  if (includeLineStats) {
    const actionableLines = await aggregateWeeklyActionableLines(where);
    const contractedLines = await aggregateContractedServiceLines(where);
    Object.assign(payload, {
      weekly_actionable_items: actionableLines.total_items,
      actionable_by_status: actionableLines.by_status,
      actionable_by_category: actionableLines.by_category,
      contracted_service_lines: contractedLines.total_lines,
      contracted_total_amount: contractedLines.total_amount,
      contracted_by_service: contractedLines.by_service,
    });
  }

  return payload;
};

const dashboard = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const data = await buildDashboardPayload(SOC_ZONES_REPORT_SOURCES, where, { includeLineStats: true });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const SOC_REPORT_BY_KEY = Object.fromEntries(SOC_ZONES_REPORT_SOURCES.map((r) => [r.key, r]));

const countSocDrillRecord = async (user, query, recordSegment) => {
  const scoped = await buildStateOfficeListWhere(user, query);

  if (recordSegment === "reports" && query.report_type) {
    const src = SOC_REPORT_BY_KEY[query.report_type];
    if (!src) return 0;
    if (query.status) scoped.status = query.status;
    return src.model.count({ where: scoped });
  }

  let total = 0;
  for (const src of SOC_ZONES_REPORT_SOURCES) {
    const w = { ...scoped };
    if (query.status) w.status = query.status;
    if (query.month) {
      const [y, m] = String(query.month).split("-");
      if (y) w.reporting_year = y;
      if (m) w.reporting_month = Number(m);
    }
    total += await src.model.count({ where: w });
  }
  return total;
};

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
      for (const src of SOC_ZONES_REPORT_SOURCES) {
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
      if (req.query.status) where.status = req.query.status;
      if (req.query.month) {
        const [y, m] = String(req.query.month).split("-");
        if (y) where.reporting_year = y;
        if (m) where.reporting_month = Number(m);
      }
      const combined = [];
      for (const src of SOC_ZONES_REPORT_SOURCES) {
        const rows = await src.model.findAll({
          where,
          include: geoInclude,
          order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]],
          limit: 40,
        });
        rows.forEach((r) => {
          combined.push({
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
            meta: `report_type:${src.key}`,
          });
        });
      }
      combined.sort((a, b) => String(b.date || b.subtitle).localeCompare(String(a.date || a.subtitle)));
      return res.json({ success: true, data: combined.slice(0, 200) });
    }

    const reportKey = req.query.report_type;
    const src = reportKey ? SOC_REPORT_BY_KEY[reportKey] : null;
    if (!src) {
      return res.status(422).json({
        success: false,
        message: "report_type required (weekly_actionable | contracted_services)",
      });
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.month) {
      const [y, m] = String(req.query.month).split("-");
      if (y) where.reporting_year = y;
      if (m) where.reporting_month = Number(m);
    }
    const rows = await src.model.findAll({
      where,
      include: geoInclude,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]],
      limit: 200,
    });
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
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
        meta: r.submitted_by,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { dashboard, dashboardDrill, SOC_ZONES_REPORT_SOURCES, OTHERS_REPORT_SOURCES };
