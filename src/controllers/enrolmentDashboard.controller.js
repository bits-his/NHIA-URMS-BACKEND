/**
 * Enrolment dashboard for State Office roles.
 * Figures come from enrolment_reports. Attainment against an annual target
 * stays empty until a target is stored — the deck's sample targets are not data.
 */
const {
  EnrolmentReport,
  StateOffice,
  ZonalOffice,
} = require("../models");
const driveRules = require("../utils/enrolmentDriveWorkflow");

const ACTIVITIES = ["enrolment", "nin_validation", "id_card_issuance", "validation_of_enrolees"];
const PROGRAM_ORDER = ["FSSHIP", "BHCPF", "GIFSHIP", "TISHIP", "OPS", "Other"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(part, whole) {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function endOfMonth(year, month) {
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(from, to) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatShort(iso) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}`;
}

function detailsOf(row) {
  const raw = row.program_details;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function programBucket(name) {
  const n = String(name || "").trim().toUpperCase();
  if (!n) return "Other";
  if (n.includes("FSSHIP")) return "FSSHIP";
  if (n.includes("BHCPF")) return "BHCPF";
  if (n.includes("GIFSHIP")) return "GIFSHIP";
  if (n.includes("TISHIP")) return "TISHIP";
  if (n === "OPS" || n.includes("OPS")) return "OPS";
  return "Other";
}

function volume(row) {
  const n = num(row.enrolment_count);
  if (n > 0) return n;
  if (row.category === "enrolment" || row.category === "id_card_issuance") return 1;
  return 0;
}

function cardLabel(raw) {
  const v = String(raw || "").trim();
  if (/^issuance/i.test(v)) return "New card";
  if (/^replacement/i.test(v)) return "Replacement";
  return v || "Unspecified";
}

function bump(map, key, amount) {
  map.set(key, (map.get(key) || 0) + amount);
}

function bars(map, order) {
  const keys = order
    ? order.filter((key) => map.has(key) || order.includes(key))
    : [...map.keys()];
  const rows = (order ? order : keys).map((label) => ({ label, value: map.get(label) || 0 }));
  return order ? rows : rows.sort((a, b) => b.value - a.value);
}

function dashboardView(user) {
  const role = String(user?.role || "").trim().toLowerCase().replace(/_/g, "-");
  const scope = user?.role_config?.report_scope;
  if (["admin", "sdo", "dg-ceo", "hq-department"].includes(role)) return "national";
  if (scope === "national" && !user?.state_code) return "national";
  if (scope === "zonal" || role === "zc" || role.includes("zonal")) return "zonal";
  return "state";
}

function bestStatus(current, next) {
  const rank = { accepted: 4, submitted: 3, returned: 2, "not sent": 1 };
  if (!current) return next;
  return (rank[next] || 0) > (rank[current] || 0) ? next : current;
}

function officeStatus(reports) {
  let status = "not sent";
  let submittedOn = null;
  for (const row of reports) {
    const note = String(row.coordinator_review_note || "").trim();
    let next = "not sent";
    if (row.status === "approved") next = "accepted";
    else if (row.status === "submitted") next = "submitted";
    else if (row.status === "draft" && note) next = "returned";
    status = bestStatus(status, next);
    const when = row.submission_date || (row.status !== "draft" ? String(row.createdAt || "").slice(0, 10) : null);
    if (when && (!submittedOn || when < submittedOn)) submittedOn = when;
  }
  return { status, submittedOn };
}

function statusLabel(status) {
  if (status === "accepted") return "Accepted";
  if (status === "submitted") return "Submitted";
  if (status === "returned") return "Returned";
  return "Not sent";
}

function reportingLabel(status, onTime) {
  if (status === "not sent") return "Not sent";
  if (status === "returned") return "Returned";
  return onTime ? "On time" : "Late";
}

function flagFor(reporting, completeness) {
  if (reporting === "Not sent") return "Escalate";
  if (reporting === "Returned" || reporting === "Late") return "Intervene";
  if (completeness != null && completeness < 100) return "Watch";
  return "On track";
}

function buildDashboard({ rows, offices, year, month, programme, view }) {
  const today = todayIso();
  const due = endOfMonth(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prev2 = prevMonth === 1 ? 12 : prevMonth - 1;

  const matchesProgram = (row) => !programme || programBucket(row.program_name) === programme;
  const inMonth = (row, m) => Number(row.reporting_month) === m;
  const scoped = rows.filter(matchesProgram);
  const period = scoped.filter((row) => inMonth(row, month));
  const enrolment = (list) => list.filter((row) => row.category === "enrolment");

  const byProgram = new Map(PROGRAM_ORDER.map((label) => [label, 0]));
  const byMode = new Map();
  const byChannel = new Map();
  const byMonth = new Map(MONTHS.map((label) => [label, 0]));
  const byType = new Map();
  let enrolled = 0;
  let annualEnrolled = 0;
  let zeroCost = 0;
  let budgeted = 0;
  const fundingByProgram = new Map();

  for (const row of enrolment(scoped)) {
    const count = volume(row);
    annualEnrolled += count;
    const bucket = programBucket(row.program_name);
    const monthLabel = MONTHS[(Number(row.reporting_month) || 1) - 1];
    if (monthLabel) bump(byMonth, monthLabel, count);
    if (!inMonth(row, month)) continue;
    enrolled += count;
    bump(byProgram, bucket, count);
    bump(byMode, row.enrolment_category || row.drive_enrolment_mode || "Unspecified", count);
    bump(byChannel, row.enrolment_channel || "Unspecified", count);
    bump(byType, row.enrolment_type || "Unspecified", count);
    const fundKey = String(row.funding_option || "");
    const fund = /^budgeted/i.test(fundKey) ? "budgeted" : (/^zero-cost/i.test(fundKey) ? "zero" : null);
    if (fund === "budgeted") budgeted += count;
    if (fund === "zero") zeroCost += count;
    if (fund) {
      if (!fundingByProgram.has(bucket)) fundingByProgram.set(bucket, { zero: 0, budgeted: 0 });
      fundingByProgram.get(bucket)[fund] += count;
    }
  }

  const categories = new Set(period.map((row) => row.category).filter(Boolean));
  const missing = ACTIVITIES.filter((key) => !categories.has(key));
  const completeness = pct(ACTIVITIES.length - missing.length, ACTIVITIES.length);

  const submissions = period.length;
  const mySubmissions = period.filter((row) => row.status === "submitted" || row.status === "approved").length;

  const cards = period.filter((row) => row.category === "id_card_issuance");
  const byCardCategory = new Map();
  const pendingByProgram = new Map();
  let issued = 0;
  let pending = 0;
  let pendingOver14 = 0;
  for (const row of cards) {
    const count = volume(row);
    const detail = detailsOf(row);
    const status = String(detail.id_card_status || "").trim();
    bump(byCardCategory, cardLabel(detail.request_category), count);
    if (/^issued$/i.test(status)) {
      issued += count;
    } else {
      pending += count;
      bump(pendingByProgram, programBucket(row.program_name), count);
      const started = String(row.activity_date || row.submission_date || "").slice(0, 10);
      const age = started ? daysBetween(started, today) : null;
      if (age != null && age > 14) pendingOver14 += count;
    }
  }

  const ninRows = period.filter((row) => row.category === "nin_validation");
  let ninChecked = 0;
  let ninValidated = 0;
  for (const row of ninRows) {
    const detail = detailsOf(row);
    const checked = num(row.enrolment_count) || 1;
    ninChecked += checked;
    const validated = num(row.enrollees_validated);
    if (validated) ninValidated += validated;
    else if (/^validated$/i.test(String(detail.validation_status || detail.nin_status || ""))) ninValidated += checked;
  }

  const gifshipRows = enrolment(scoped).filter((row) => programBucket(row.program_name) === "GIFSHIP");
  const gifshipPeriod = gifshipRows.filter((row) => inMonth(row, month));
  let gifshipTotal = 0;
  let gifshipActive = 0;
  let expire30 = 0;
  let expire60 = 0;
  let renewalStarted = 0;
  let overdue = 0;
  let overdueOver14 = 0;
  const expiryByMonth = new Map();
  const renewalByType = new Map();
  const queue = [];
  const horizon = addDays(today, 150);

  for (const row of gifshipRows) {
    const count = volume(row);
    const detail = detailsOf(row);
    const expiry = String(detail.expiry_date || "").slice(0, 10);
    const renewalStatus = String(detail.renewal_status || "");
    const isRenewal = String(row.enrolment_type || "") === "Renewal";
    const isOverdue = renewalStatus === "Overdue" || (expiry && expiry < today);
    if (inMonth(row, month)) {
      gifshipTotal += count;
      bump(renewalByType, row.program_name || "GIFSHIP", count);
      if (isRenewal) renewalStarted += count;
      if (!isOverdue) gifshipActive += count;
    }
    if (isOverdue) {
      overdue += count;
      if (expiry && daysBetween(expiry, today) > 14) overdueOver14 += count;
    }
    if (expiry && expiry >= today && expiry <= addDays(today, 30)) expire30 += count;
    if (expiry && expiry >= today && expiry <= addDays(today, 60)) expire60 += count;
    if (expiry && expiry >= today && expiry <= horizon) {
      const label = `${expiry.slice(0, 7)}`;
      const [y, m] = label.split("-");
      const pretty = `${MONTHS[Number(m) - 1]} ${y}`;
      bump(expiryByMonth, pretty, count);
      const name = [detail.surname, detail.first_name].filter(Boolean).join(" ")
        || detail.enrollee_name
        || row.reference_id;
      queue.push({
        beneficiary: name,
        gifship_type: row.program_name || "GIFSHIP",
        expiry: formatShort(expiry),
        days_left: daysBetween(today, expiry),
        phone: detail.phone_number || detail.sponsor_phone || "—",
      });
    }
  }
  queue.sort((a, b) => a.days_left - b.days_left);

  const byState = new Map();
  const byZone = new Map();
  for (const row of enrolment(scoped)) {
    const count = volume(row);
    const state = row.state?.description || row.state_code;
    const zone = row.zone?.description || row.zonal_code;
    if (!byState.has(row.state_code)) {
      byState.set(row.state_code, { code: row.state_code, label: state, zone, value: 0, months: {} });
    }
    const entry = byState.get(row.state_code);
    entry.months[row.reporting_month] = (entry.months[row.reporting_month] || 0) + count;
    if (inMonth(row, month)) {
      entry.value += count;
      if (!byZone.has(row.zonal_code)) byZone.set(row.zonal_code, { code: row.zonal_code, label: zone, value: 0 });
      byZone.get(row.zonal_code).value += count;
    }
  }

  const reportsByState = new Map();
  for (const row of scoped.filter((item) => inMonth(item, month))) {
    if (!reportsByState.has(row.state_code)) reportsByState.set(row.state_code, []);
    reportsByState.get(row.state_code).push(row);
  }

  const compliance = offices.map((office) => {
    const json = office.toJSON ? office.toJSON() : office;
    const list = reportsByState.get(json.code) || [];
    const { status, submittedOn } = officeStatus(list);
    const present = new Set(list.map((row) => row.category));
    const officeCompleteness = pct(ACTIVITIES.filter((key) => present.has(key)).length, ACTIVITIES.length);
    const onTime = Boolean(submittedOn && submittedOn <= due && status !== "not sent" && status !== "returned");
    const reporting = reportingLabel(status, onTime);
    const enrolledHere = byState.get(json.code)?.value || 0;
    const cardRows = list.filter((row) => row.category === "id_card_issuance");
    let cardReceived = 0;
    let cardIssued = 0;
    let officeOverdue = 0;
    let officeGifship = 0;
    for (const row of cardRows) {
      const count = volume(row);
      cardReceived += count;
      if (/^issued$/i.test(String(detailsOf(row).id_card_status || ""))) cardIssued += count;
    }
    for (const row of list) {
      if (row.category !== "enrolment" || programBucket(row.program_name) !== "GIFSHIP") continue;
      const count = volume(row);
      officeGifship += count;
      const detail = detailsOf(row);
      const expiry = String(detail.expiry_date || "").slice(0, 10);
      if (detail.renewal_status === "Overdue" || (expiry && expiry < today)) officeOverdue += count;
    }
    const months = byState.get(json.code)?.months || {};
    const current = months[month] || 0;
    const previous = months[prevMonth] || 0;
    const earlier = months[prev2] || 0;
    const declining = earlier > previous && previous > current;
    const renewalRate = officeGifship ? officeOverdue / officeGifship : 0;
    return {
      code: json.code,
      office: json.description || json.code,
      zone: json.zone?.description || json.zonal_code,
      status: statusLabel(status),
      reporting,
      submitted: submittedOn ? formatShort(submittedOn) : "—",
      due: formatShort(due),
      on_time: onTime,
      completeness: officeCompleteness,
      enrolled: enrolledHere,
      previous,
      change: current - previous,
      change_pct: pct(current - previous, previous),
      id_card_ratio: pct(cardIssued, cardReceived),
      flag: flagFor(reporting, officeCompleteness),
      declining,
      renewal_overdue_pct: pct(officeOverdue, officeGifship),
      renewal_backlog: renewalRate > 0.2,
      earlier,
      current,
    };
  });

  const submittedOffices = compliance.filter((row) => row.status === "Accepted" || row.status === "Submitted");
  const onTimeOffices = compliance.filter((row) => row.on_time);
  const flagged = compliance.filter((row) => row.flag !== "On track");

  const values = compliance.map((row) => row.enrolled).filter((value) => value > 0);
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const variance = values.length
    ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
    : 0;
  const spread = Math.sqrt(variance);
  const outliers = spread
    ? compliance
      .filter((row) => Math.abs(row.enrolled - mean) > spread)
      .map((row) => ({
        state: row.office,
        value: row.enrolled,
        flag: row.enrolled < mean ? "Below peer range" : "Above peer range",
      }))
    : [];

  const performance = compliance
    .map((row) => {
      const reasons = [];
      if (row.declining) reasons.push("declining");
      if (row.reporting === "Late" || row.reporting === "Not sent" || row.reporting === "Returned" || (row.completeness != null && row.completeness < 100)) {
        reasons.push("submission");
      }
      if (row.renewal_backlog) reasons.push("renewal");
      if (!reasons.length) return null;
      const priority = reasons.length > 1 || row.flag === "Escalate" ? "High" : "Medium";
      const changeText = row.earlier || row.previous
        ? `${row.change_pct == null ? "—" : `${row.change_pct > 0 ? "+" : ""}${row.change_pct}%`}`
        : "—";
      return {
        state: row.office,
        change: changeText,
        previous: row.previous,
        current: row.current,
        earlier: row.earlier,
        attainment: null,
        submission: row.reporting === "On time" && row.completeness === 100 ? "Complete" : row.reporting,
        renewals_overdue: row.renewal_overdue_pct,
        priority,
      };
    })
    .filter(Boolean);

  const fundingRows = PROGRAM_ORDER.filter((label) => label !== "Other" || fundingByProgram.has("Other")).map((label) => ({
    programme: label,
    zero_cost: fundingByProgram.get(label)?.zero || 0,
    budgeted: fundingByProgram.get(label)?.budgeted || 0,
  }));

  const channelBars = [...byChannel.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    view,
    period: { year, month, label: `${MONTHS[month - 1]} ${year}`, programme: programme || "All programmes" },
    note: "Enrolment targets are not configured. Coverage against a target stays blank. Counts are recorded enrolment activities.",
    kpis: {
      submissions,
      submitted: mySubmissions,
      activities: period.length,
      enrolled,
      annual_enrolled: annualEnrolled,
      coverage_pct: null,
      annual_target: null,
      gifship_renewals_due: expire60,
      gifship_overdue_over_14: overdueOver14,
      reporting_completeness: completeness,
      incomplete_activities: missing.length,
      offices_expected: offices.length,
      offices_submitted: submittedOffices.length,
      offices_on_time: onTimeOffices.length,
      nin_validation_pct: pct(ninValidated, ninChecked),
      pending_cards: pending,
      pending_cards_over_14: pendingOver14,
      flagged_states: flagged.length,
      gifship_total: gifshipTotal,
      gifship_active: gifshipActive,
      expire_30: expire30,
      expire_60: expire60,
      renewal_started: renewalStarted,
      overdue,
      cards_received: cards.reduce((sum, row) => sum + volume(row), 0),
      cards_issued: issued,
      issuance_rate: pct(issued, cards.reduce((sum, row) => sum + volume(row), 0)),
      zero_cost: zeroCost,
      budgeted,
      funding_total: zeroCost + budgeted,
      renewal_rate: pct(renewalStarted, gifshipTotal),
      declining_states: compliance.filter((row) => row.declining).length,
      submission_gaps: compliance.filter((row) => row.reporting !== "On time").length,
      renewal_backlog_states: compliance.filter((row) => row.renewal_backlog).length,
    },
    by_program: bars(byProgram, PROGRAM_ORDER),
    by_month: MONTHS.map((label) => ({ label, value: byMonth.get(label) || 0 })),
    by_mode: bars(byMode),
    by_channel: channelBars,
    by_type: bars(byType),
    by_state: [...byState.values()].map(({ code, label, value }) => ({ code, label, value })).sort((a, b) => b.value - a.value),
    by_zone: [...byZone.values()].sort((a, b) => b.value - a.value),
    cards: {
      by_category: bars(byCardCategory),
      pending_by_program: bars(pendingByProgram, PROGRAM_ORDER).filter((row) => row.value > 0),
    },
    gifship: {
      by_month: [...expiryByMonth.entries()].map(([label, value]) => ({ label, value })),
      by_type: bars(renewalByType),
      queue: queue.slice(0, 8),
    },
    compliance,
    outliers,
    funding: fundingRows,
    performance,
  };
}

const dashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = req.query.month && req.query.month !== "all"
      ? Number(req.query.month)
      : now.getMonth() + 1;
    const programme = req.query.programme && req.query.programme !== "all"
      ? String(req.query.programme)
      : null;
    if (!month || month < 1 || month > 12) {
      return res.status(422).json({ success: false, message: "Month must be between 1 and 12" });
    }

    const scope = driveRules.scopeWhere(req.user);
    const where = { reporting_year: year, ...scope };
    const requestedZone = req.query.zonal_code || req.query.zone_id;
    const requestedState = req.query.state_code || req.query.state_id;
    if (!scope.state_code && requestedState && requestedState !== "all") where.state_code = requestedState;
    if (!scope.zonal_code && !scope.state_code && requestedZone && requestedZone !== "all") {
      where.zonal_code = requestedZone;
    }
    if (scope.zonal_code && requestedZone && requestedZone !== "all" && String(requestedZone) !== String(scope.zonal_code)) {
      return res.status(403).json({ success: false, message: "That zone is outside your assignment" });
    }

    const officeWhere = {};
    if (where.state_code) officeWhere.code = where.state_code;
    if (where.zonal_code) officeWhere.zonal_code = where.zonal_code;

    const [rows, offices] = await Promise.all([
      EnrolmentReport.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"], required: false },
          { model: StateOffice, as: "state", attributes: ["code", "description"], required: false },
        ],
        order: [["reporting_month", "ASC"], ["reference_id", "ASC"]],
      }),
      StateOffice.findAll({
        where: officeWhere,
        include: [{ model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"], required: false }],
        order: [["description", "ASC"]],
      }),
    ]);

    const data = buildDashboard({
      rows: rows.map((row) => (row.toJSON ? row.toJSON() : row)),
      offices,
      year,
      month,
      programme,
      view: dashboardView(req.user),
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = { dashboard, buildDashboard, dashboardView };
