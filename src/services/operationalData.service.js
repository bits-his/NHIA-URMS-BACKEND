const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  StateOffice,
  ZonalOffice,
  FinanceMonthlyReport,
  ProgrammesMonthlyReport,
  SqaMonthlyReport,
} = require("../models");
const { findActiveRole } = require("../utils/roleService");

const COUNTABLE_STATUSES = ["submitted", "under_review", "zonal_review", "approved"];

const QUARTER_MONTHS = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const latest = (records, field) => {
  const sorted = [...records].sort((a, b) => b.reporting_month - a.reporting_month);
  for (const r of sorted) {
    if (r[field] !== null && r[field] !== undefined && r[field] !== "") return num(r[field]);
  }
  return null;
};

const sumField = (records, field) =>
  records.reduce((acc, r) => acc + num(r[field]), 0);

const quarterSum = (records, field, quarter) => {
  const months = QUARTER_MONTHS[quarter];
  return records
    .filter((r) => months.includes(r.reporting_month))
    .reduce((acc, r) => acc + num(r[field]), 0);
};

const quarterlyBlock = (records, field) => {
  const q1 = quarterSum(records, field, 1);
  const q2 = quarterSum(records, field, 2);
  const q3 = quarterSum(records, field, 3);
  const q4 = quarterSum(records, field, 4);
  return { q1, q2, q3, q4, sub_total: q1 + q2 + q3 + q4 };
};

const blockFromFlat = (row, q1Key, q2Key, q3Key, q4Key) => {
  const q1 = num(row[q1Key]);
  const q2 = num(row[q2Key]);
  const q3 = num(row[q3Key]);
  const q4 = num(row[q4Key]);
  return { q1, q2, q3, q4, sub_total: q1 + q2 + q3 + q4 };
};

function mapViewRowToApi(row, index) {
  return {
    sn: index + 1,
    state_id: row.state_id,
    state: row.state,
    zone_id: row.zone_id,
    zone: row.zone ?? null,
    zone_code: row.zone_code ?? null,
    reporting_year: row.reporting_year,
    staff_no: row.staff_no != null ? num(row.staff_no) : null,
    total_vehicles: row.total_vehicles != null ? num(row.total_vehicles) : null,
    total_hcf_under_nhia: row.total_hcf_under_nhia != null ? num(row.total_hcf_under_nhia) : null,
    total_accredited_hcf: row.total_accredited_hcf != null ? num(row.total_accredited_hcf) : null,
    approved_budget: row.approved_budget != null ? num(row.approved_budget) : null,
    total_amount_utilized: num(row.total_amount_utilized),
    cemonc_accredited_hcf: row.cemonc_accredited_hcf != null ? num(row.cemonc_accredited_hcf) : null,
    cemonc_beneficiaries: row.cemonc_beneficiaries != null ? num(row.cemonc_beneficiaries) : null,
    ffp_accredited_facilities: row.ffp_accredited_facilities != null ? num(row.ffp_accredited_facilities) : null,
    ffp_beneficiaries: row.ffp_beneficiaries != null ? num(row.ffp_beneficiaries) : null,
    gifship_enrolments: blockFromFlat(row, "gifship_enr_q1", "gifship_enr_q2", "gifship_enr_q3", "gifship_enr_q4"),
    gifship_premium: blockFromFlat(row, "gifship_prem_q1", "gifship_prem_q2", "gifship_prem_q3", "gifship_prem_q4"),
    ops_count: blockFromFlat(row, "ops_q1", "ops_q2", "ops_q3", "ops_q4"),
    fsship_new_enrolments: blockFromFlat(row, "fsship_q1", "fsship_q2", "fsship_q3", "fsship_q4"),
    extra_dependants: blockFromFlat(row, "extra_dep_q1", "extra_dep_q2", "extra_dep_q3", "extra_dep_q4"),
    extra_dependant_premium: blockFromFlat(row, "extra_prem_q1", "extra_prem_q2", "extra_prem_q3", "extra_prem_q4"),
    additional_dependants: blockFromFlat(row, "add_dep_q1", "add_dep_q2", "add_dep_q3", "add_dep_q4"),
    change_of_provider: blockFromFlat(row, "cop_q1", "cop_q2", "cop_q3", "cop_q4"),
    bhcpf_beneficiaries: row.bhcpf_beneficiaries != null ? num(row.bhcpf_beneficiaries) : null,
    bhcpf_facilities: row.bhcpf_facilities != null ? num(row.bhcpf_facilities) : null,
    tiship_lives: row.tiship_lives != null ? num(row.tiship_lives) : null,
    mha_lives: row.mha_lives != null ? num(row.mha_lives) : null,
    sshia_lives: row.sshia_lives != null ? num(row.sshia_lives) : null,
    complaints_registered: num(row.complaints_registered),
    complaints_resolved: num(row.complaints_resolved),
    complaints_escalated: num(row.complaints_escalated),
    igr: blockFromFlat(row, "igr_q1", "igr_q2", "igr_q3", "igr_q4"),
    qa_conducted: blockFromFlat(row, "qa_q1", "qa_q2", "qa_q3", "qa_q4"),
    accreditation_requests: blockFromFlat(row, "acc_req_q1", "acc_req_q2", "acc_req_q3", "acc_req_q4"),
    accreditation_conducted: blockFromFlat(row, "acc_con_q1", "acc_con_q2", "acc_con_q3", "acc_con_q4"),
    marketing_sensitization: blockFromFlat(row, "mkt_q1", "mkt_q2", "mkt_q3", "mkt_q4"),
    stakeholder_meetings: num(row.stakeholder_meetings),
    media_appearances: num(row.media_appearances),
    reconciliation_meetings: num(row.reconciliation_meetings),
    total_indebtedness: num(row.total_indebtedness),
    amount_recovered: num(row.amount_recovered),
    months_with_data: {
      finance: num(row.finance_months),
      programmes: num(row.programmes_months),
      sqa: num(row.sqa_months),
    },
  };
}

async function fetchFromView(year, stateWhere) {
  const clauses = ["reporting_year = :year"];
  const replacements = { year };

  if (stateWhere.id) {
    clauses.push("state_id = :state_id");
    replacements.state_id = stateWhere.id;
  }
  if (stateWhere.zonal_id) {
    clauses.push("zone_id = :zone_id");
    replacements.zone_id = stateWhere.zonal_id;
  }

  const sql = `
    SELECT *
    FROM v_state_operational_annual
    WHERE ${clauses.join(" AND ")}
    ORDER BY state ASC
  `;

  const [rows] = await sequelize.query(sql, { replacements });
  return rows;
}

async function fetchMonthlyForYear(year, stateIds) {
  const base = { reporting_year: year, status: { [Op.in]: COUNTABLE_STATUSES } };
  const stateFilter = stateIds?.length ? { state_id: { [Op.in]: stateIds } } : {};

  const [finance, programmes, sqa] = await Promise.all([
    FinanceMonthlyReport.findAll({ where: { ...base, ...stateFilter } }),
    ProgrammesMonthlyReport.findAll({ where: { ...base, ...stateFilter } }),
    SqaMonthlyReport.findAll({ where: { ...base, ...stateFilter } }),
  ]);

  return { finance, programmes, sqa };
}

function buildStateRow(state, finance, programmes, sqa, year) {
  const fin = finance.filter((r) => r.state_id === state.id && r.section === "finance");
  const finAdmin = finance.filter((r) => r.state_id === state.id && r.section === "admin");
  const prgEnrol = programmes.filter((r) => r.state_id === state.id && r.section === "enrolment");
  const prgOutreach = programmes.filter((r) => r.state_id === state.id && r.section === "outreach");
  const sqaMain = sqa.filter((r) => r.state_id === state.id && r.section === "sqa");
  const sqaComplaints = sqa.filter((r) => r.state_id === state.id && r.section === "complaints");

  const allFin = [...fin, ...finAdmin];

  return {
    state_id: state.id,
    state: state.description,
    zone_id: state.zonal_id,
    reporting_year: year,
    staff_no: latest(allFin, "staff_no") ?? latest(fin, "staff_no"),
    total_vehicles: latest(allFin, "total_vehicles") ?? latest(fin, "total_vehicles"),
    total_hcf_under_nhia: latest(sqaMain, "total_hcf_under_nhia"),
    total_accredited_hcf: latest(sqaMain, "total_accredited_hcf"),
    approved_budget: latest(fin, "approved_budget"),
    total_amount_utilized: sumField(fin, "total_amount_utilized"),
    cemonc_accredited_hcf: latest(sqaMain, "cemonc_accredited_hcf"),
    cemonc_beneficiaries: latest(sqaMain, "cemonc_beneficiaries"),
    ffp_accredited_facilities: latest(sqaMain, "ffp_accredited_facilities"),
    ffp_beneficiaries: latest(sqaMain, "ffp_beneficiaries"),
    gifship_enrolments: quarterlyBlock(prgEnrol, "gifship_enrolments"),
    gifship_premium: quarterlyBlock(prgEnrol, "gifship_premium"),
    ops_count: quarterlyBlock(prgEnrol, "ops_count"),
    fsship_new_enrolments: quarterlyBlock(prgEnrol, "fsship_new_enrolments"),
    extra_dependants: quarterlyBlock(prgEnrol, "extra_dependants"),
    extra_dependant_premium: quarterlyBlock(prgEnrol, "extra_dependant_premium"),
    additional_dependants: quarterlyBlock(prgEnrol, "additional_dependants"),
    change_of_provider: quarterlyBlock(prgEnrol, "change_of_provider"),
    bhcpf_beneficiaries: latest(prgEnrol, "bhcpf_beneficiaries"),
    bhcpf_facilities: latest(prgEnrol, "bhcpf_facilities"),
    tiship_lives: latest(prgEnrol, "tiship_lives"),
    mha_lives: latest(prgEnrol, "mha_lives"),
    sshia_lives: latest(prgEnrol, "sshia_lives"),
    complaints_registered: sumField(sqaComplaints, "complaints_registered"),
    complaints_resolved: sumField(sqaComplaints, "complaints_resolved"),
    complaints_escalated: sumField(sqaComplaints, "complaints_escalated"),
    igr: quarterlyBlock(fin, "igr_amount"),
    qa_conducted: quarterlyBlock(sqaMain, "qa_conducted"),
    accreditation_requests: quarterlyBlock(sqaMain, "accreditation_requests"),
    accreditation_conducted: quarterlyBlock(sqaMain, "accreditation_conducted"),
    marketing_sensitization: quarterlyBlock(prgOutreach, "marketing_sensitization"),
    stakeholder_meetings: sumField(prgOutreach, "stakeholder_meetings"),
    media_appearances: sumField(prgOutreach, "media_appearances"),
    reconciliation_meetings: sumField(fin, "reconciliation_meetings"),
    total_indebtedness: sumField(fin, "total_indebtedness"),
    amount_recovered: sumField(fin, "amount_recovered"),
    months_with_data: {
      finance: new Set(fin.map((r) => r.reporting_month)).size,
      programmes: new Set(prgEnrol.map((r) => r.reporting_month)).size,
      sqa: new Set(sqaMain.map((r) => r.reporting_month)).size,
    },
  };
}

function resolveStateWhere(options = {}) {
  const { state_id, zone_id, user, scope } = options;
  const stateWhere = {};

  if (state_id) stateWhere.id = state_id;
  if (zone_id) stateWhere.zonal_id = zone_id;

  if (scope === "state" && user?.state_id) {
    stateWhere.id = user.state_id;
  } else if (scope === "zonal" && user?.zone_id) {
    stateWhere.zonal_id = user.zone_id;
    if (state_id) stateWhere.id = state_id;
  } else if (!state_id && !zone_id) {
    if (scope === "state" && user?.state_id) {
      stateWhere.id = user.state_id;
    } else if (scope === "zonal" && user?.zone_id) {
      stateWhere.zonal_id = user.zone_id;
    }
  }

  return stateWhere;
}

function buildResponseMeta(rows, year, state_id, zone_id) {
  let zoneLabel = null;
  let stateLabel = null;
  if (rows.length === 1) {
    stateLabel = rows[0].state;
    zoneLabel = rows[0].zone ?? null;
  } else if (zone_id && rows[0]) {
    zoneLabel = rows[0].zone ?? null;
  }

  return {
    year,
    title: `STATE OFFICES OPERATIONAL DATA — JANUARY–DECEMBER ${year}`,
    zone_id: zone_id ?? (state_id && rows[0] ? rows[0].zone_id : null),
    zone_name: zoneLabel,
    state_id: state_id ?? null,
    state_name: stateLabel,
    rows,
    state_count: rows.length,
  };
}

/**
 * Aggregate state office operational data for a year.
 * Prefers DB view v_state_operational_annual; falls back to in-app aggregation.
 */
async function getOperationalData(year, options = {}) {
  const { state_id, zone_id, user } = options;
  const roleDef = user?.role ? await findActiveRole(user.role) : null;
  const scope = roleDef?.report_scope || "none";
  const stateWhere = resolveStateWhere({ state_id, zone_id, user, scope });

  // ── Try database view first (single SELECT, reusable by dashboard) ──
  try {
    const states = await StateOffice.findAll({
      where: stateWhere,
      include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "zonal_code", "description"] }],
      order: [["description", "ASC"]],
    });

    const viewRows = await fetchFromView(year, stateWhere);
    const viewByState = new Map(viewRows.map((r) => [r.state_id, r]));

    const rows = states.map((state, index) => {
      const vr = viewByState.get(state.id);
      if (vr) return mapViewRowToApi(vr, index);
      return {
        sn: index + 1,
        state_id: state.id,
        state: state.description,
        zone_id: state.zonal_id,
        zone: state.zone?.description ?? null,
        zone_code: state.zone?.zonal_code ?? null,
        reporting_year: year,
        staff_no: null,
        total_vehicles: null,
        total_hcf_under_nhia: null,
        total_accredited_hcf: null,
        approved_budget: null,
        total_amount_utilized: 0,
        cemonc_accredited_hcf: null,
        cemonc_beneficiaries: null,
        ffp_accredited_facilities: null,
        ffp_beneficiaries: null,
        gifship_enrolments: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        gifship_premium: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        ops_count: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        fsship_new_enrolments: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        extra_dependants: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        extra_dependant_premium: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        additional_dependants: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        change_of_provider: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        bhcpf_beneficiaries: null,
        bhcpf_facilities: null,
        tiship_lives: null,
        mha_lives: null,
        sshia_lives: null,
        complaints_registered: 0,
        complaints_resolved: 0,
        complaints_escalated: 0,
        igr: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        qa_conducted: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        accreditation_requests: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        accreditation_conducted: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        marketing_sensitization: { q1: 0, q2: 0, q3: 0, q4: 0, sub_total: 0 },
        stakeholder_meetings: 0,
        media_appearances: 0,
        reconciliation_meetings: 0,
        total_indebtedness: 0,
        amount_recovered: 0,
        months_with_data: { finance: 0, programmes: 0, sqa: 0 },
      };
    });

    return {
      ...buildResponseMeta(rows, year, state_id, zone_id),
      source: "view",
    };
  } catch (err) {
    // View not created yet — fall through to legacy aggregation
    if (process.env.NODE_ENV === "development") {
      console.warn("[operationalData] v_state_operational_annual unavailable, using JS aggregation:", err.message);
    }
  }

  // ── Legacy: load all monthly rows and aggregate in Node ──
  const states = await StateOffice.findAll({
    where: stateWhere,
    include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "zonal_code", "description"] }],
    order: [["description", "ASC"]],
  });

  const stateIds = states.map((s) => s.id);
  const { finance, programmes, sqa } = await fetchMonthlyForYear(year, stateIds.length ? stateIds : undefined);

  const rows = states.map((state, index) => ({
    sn: index + 1,
    ...buildStateRow(state, finance, programmes, sqa, year),
    zone: state.zone?.description ?? null,
    zone_code: state.zone?.zonal_code ?? null,
  }));

  return {
    ...buildResponseMeta(rows, year, state_id, zone_id),
    source: "monthly_reports",
  };
}

module.exports = { getOperationalData };
