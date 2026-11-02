/**
 * Finance dashboards — IGR + SSHIA only (Expenditure excluded per PPT).
 * Role-scoped: state → own office; zonal → zone; SDO/HQ → national.
 */
const { Op } = require("sequelize");
const {
  FinanceIgrReport,
  FinanceSshiaReport,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { SSHIA_KEYS, sshiaDerived } = require("./financePack.controller");

function scopeWhere(user, query = {}) {
  const where = {};
  const zonal = query.zonal_code || query.zone_id;
  const state = query.state_code || query.state_id;
  if (zonal) where.zonal_code = zonal;
  if (state) where.state_code = state;

  if (!zonal && user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(user.role)) {
    where.zonal_code = user.zonal_code;
  }
  if (!state && user?.state_code && String(user.role || "").includes("state")) {
    where.state_code = user.state_code;
  }
  return where;
}

function periodIgr(query = {}) {
  const where = {};
  if (query.year || query.reporting_year) where.reporting_year = Number(query.year || query.reporting_year);
  if (query.month || query.reporting_month) where.reporting_month = Number(query.month || query.reporting_month);
  if (query.service_type) where.service_type = query.service_type;
  where.status = { [Op.in]: ["submitted", "approved"] };
  return where;
}

function periodSshia(query = {}) {
  const where = {};
  if (query.year || query.reporting_year) where.reporting_year = Number(query.year || query.reporting_year);
  if (query.quarter || query.reporting_quarter) {
    where.reporting_quarter = Number(query.quarter || query.reporting_quarter);
  }
  where.status = { [Op.in]: ["submitted", "approved"] };
  return where;
}

async function igrDashboard(req, res, next) {
  try {
    const where = { ...scopeWhere(req.user, req.query), ...periodIgr(req.query) };

    const rows = await FinanceIgrReport.findAll({
      where,
      attributes: [
        "reference_id", "zonal_code", "state_code", "reporting_year", "reporting_month",
        "service_type", "amount", "receipt_no", "bill_rrr_no",
      ],
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
      ],
      order: [["reporting_year", "ASC"], ["reporting_month", "ASC"]],
    });

    let total = 0;
    let missingRefs = 0;
    const byService = {};
    const byMonth = {};
    const byState = {};
    const byZone = {};

    for (const r of rows) {
      const amount = Number(r.amount) || 0;
      total += amount;
      if (!r.receipt_no || !r.bill_rrr_no) missingRefs += 1;

      byService[r.service_type] = (byService[r.service_type] || 0) + amount;

      const mk = `${r.reporting_year}-${String(r.reporting_month).padStart(2, "0")}`;
      byMonth[mk] = (byMonth[mk] || 0) + amount;

      const sk = r.state_code;
      if (!byState[sk]) {
        byState[sk] = {
          state_code: sk,
          label: r.state?.description || sk,
          zonal_code: r.zonal_code,
          amount: 0,
          receipts: 0,
        };
      }
      byState[sk].amount += amount;
      byState[sk].receipts += 1;

      const zk = r.zonal_code;
      if (!byZone[zk]) {
        byZone[zk] = {
          zonal_code: zk,
          label: r.zone?.description || zk,
          amount: 0,
          receipts: 0,
        };
      }
      byZone[zk].amount += amount;
      byZone[zk].receipts += 1;
    }

    const receiptCount = rows.length;
    const topService = Object.entries(byService).sort((a, b) => b[1] - a[1])[0] || null;

    res.json({
      success: true,
      data: {
        kpis: {
          total_igr: total,
          receipt_count: receiptCount,
          average_receipt: receiptCount ? total / receiptCount : null,
          top_service: topService ? { service_type: topService[0], amount: topService[1] } : null,
          missing_references: missingRefs,
        },
        by_service: Object.entries(byService).map(([service_type, amount]) => ({
          service_type,
          amount,
          share_pct: total ? (amount / total) * 100 : null,
        })).sort((a, b) => b.amount - a.amount),
        by_month: Object.entries(byMonth).map(([period, amount]) => ({ period, amount })).sort((a, b) => a.period.localeCompare(b.period)),
        by_state: Object.values(byState).sort((a, b) => b.amount - a.amount),
        by_zone: Object.values(byZone).sort((a, b) => b.amount - a.amount),
      },
    });
  } catch (err) { next(err); }
}

async function sshiaDashboard(req, res, next) {
  try {
    const where = { ...scopeWhere(req.user, req.query), ...periodSshia(req.query) };
    const subHeadFilter = req.query.sub_head || null;

    const rows = await FinanceSshiaReport.findAll({
      where,
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
      ],
    });

    const prefixMap = {
      capitation: "cap",
      fee_for_service: "ffs",
      reserve_funds: "reserve",
      admin_charge: "admin",
    };
    const prefixes = subHeadFilter && prefixMap[subHeadFilter]
      ? [prefixMap[subHeadFilter]]
      : SSHIA_KEYS;

    let available = 0;
    let actual = 0;
    let lives = 0;
    let reportedAvailable = 0;
    let reportedActual = 0;
    const bySubHead = {};
    const byZone = {};
    const byState = {};
    const byQuarter = {};

    for (const key of prefixes) {
      bySubHead[key] = { available: 0, actual: 0, balance: 0, lives: 0, reported: 0 };
    }

    for (const row of rows) {
      let rowAvailable = 0;
      let rowActual = 0;
      let rowLives = 0;

      for (const key of prefixes) {
        const d = sshiaDerived(key, row);
        if (d.total_budget != null) {
          bySubHead[key].available += Number(d.total_budget);
          rowAvailable += Number(d.total_budget);
          bySubHead[key].reported += 1;
        }
        if (d.actual_expenditure != null) {
          bySubHead[key].actual += Number(d.actual_expenditure);
          rowActual += Number(d.actual_expenditure);
        }
        if (d.balance != null) bySubHead[key].balance += Number(d.balance);
        if (d.bhcpf_lives != null) {
          bySubHead[key].lives += Number(d.bhcpf_lives);
          rowLives += Number(d.bhcpf_lives);
        }
      }

      available += rowAvailable;
      actual += rowActual;
      lives += rowLives;
      if (rowAvailable) reportedAvailable += 1;
      if (rowActual) reportedActual += 1;

      const zk = row.zonal_code;
      if (!byZone[zk]) {
        byZone[zk] = {
          zonal_code: zk,
          label: row.zone?.description || zk,
          available: 0,
          actual: 0,
          lives: 0,
        };
      }
      byZone[zk].available += rowAvailable;
      byZone[zk].actual += rowActual;
      byZone[zk].lives += rowLives;

      const sk = row.state_code;
      if (!byState[sk]) {
        byState[sk] = {
          state_code: sk,
          label: row.state?.description || sk,
          zonal_code: row.zonal_code,
          available: 0,
          actual: 0,
          lives: 0,
        };
      }
      byState[sk].available += rowAvailable;
      byState[sk].actual += rowActual;
      byState[sk].lives += rowLives;

      const qk = `Q${row.reporting_quarter}`;
      if (!byQuarter[qk]) byQuarter[qk] = { quarter: row.reporting_quarter, available: 0, actual: 0, lives: 0 };
      byQuarter[qk].available += rowAvailable;
      byQuarter[qk].actual += rowActual;
      byQuarter[qk].lives += rowLives;
    }

    const balance = available - actual;
    const utilisation = available ? (actual / available) * 100 : null;

    const subHeadLabels = {
      cap: "Capitation",
      ffs: "Fee-for-Service",
      reserve: "Reserve Funds",
      admin: "Admin. Charges",
    };

    res.json({
      success: true,
      data: {
        kpis: {
          budget_available: available,
          actual_expenditure: actual,
          balance,
          utilisation_rate: utilisation,
          bhcpf_lives_covered: lives,
          states_reporting: Object.keys(byState).length,
          zones_reporting: Object.keys(byZone).length,
          reports_count: rows.length,
        },
        by_sub_head: Object.entries(bySubHead).map(([key, v]) => ({
          key,
          label: subHeadLabels[key] || key,
          available: v.available,
          actual: v.actual,
          balance: v.balance,
          lives: v.lives,
          utilisation_rate: v.available ? (v.actual / v.available) * 100 : null,
        })),
        by_zone: Object.values(byZone).map((z) => ({
          ...z,
          utilisation_rate: z.available ? (z.actual / z.available) * 100 : null,
        })).sort((a, b) => b.actual - a.actual),
        by_state: Object.values(byState).map((s) => ({
          ...s,
          utilisation_rate: s.available ? (s.actual / s.available) * 100 : null,
        })).sort((a, b) => b.actual - a.actual),
        by_quarter: Object.values(byQuarter).sort((a, b) => a.quarter - b.quarter),
      },
    });
  } catch (err) { next(err); }
}

async function overview(req, res, next) {
  try {
    let igrData = null;
    let sshiaData = null;
    await new Promise((resolve, reject) => {
      igrDashboard(req, { json: (body) => { igrData = body?.data || null; resolve(); } }, reject);
    });
    await new Promise((resolve, reject) => {
      sshiaDashboard(req, { json: (body) => { sshiaData = body?.data || null; resolve(); } }, reject);
    });
    res.json({ success: true, data: { igr: igrData, sshia: sshiaData } });
  } catch (err) { next(err); }
}

module.exports = {
  igrDashboard,
  sshiaDashboard,
  overview,
};
