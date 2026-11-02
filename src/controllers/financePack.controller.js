/**
 * Finance packs — flat single-table forms (IGR, SSHIA, Expenditure).
 * No lines tables. Accepts legacy zone_id / state_id from FE headerPayload.
 */
const { Op } = require("sequelize");
const {
  FinanceIgrReport,
  FinanceSshiaReport,
  FinanceExpenditureProfile,
  ZonalOffice,
  StateOffice,
} = require("../models");

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

function monthFromQuarter(quarter) {
  const q = Number(quarter);
  if (!q || q < 1 || q > 4) return 1;
  return (q - 1) * 3 + 1;
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function numOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function requireAmount(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error(`${label} must be a non-negative number`);
    err.status = 422;
    throw err;
  }
  return n;
}

async function nextReferenceId(Model, prefix) {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  const last = await Model.findOne({
    where: { reference_id: { [Op.like]: `${fullPrefix}%` } },
    order: [["reference_id", "DESC"]],
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(fullPrefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${fullPrefix}${String(next).padStart(5, "0")}`;
}

function applyScope(where, user, query = {}) {
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
}

function assertScope(user, row) {
  if (!user) return;
  if (["sdo", "dg-ceo", "hq-department"].includes(user.role)) return;
  if (user.zonal_code && row.zonal_code && String(user.zonal_code) !== String(row.zonal_code)) {
    const err = new Error("Outside your zone");
    err.status = 403;
    throw err;
  }
  if (String(user.role || "").includes("state") && user.state_code
      && row.state_code && String(user.state_code) !== String(row.state_code)) {
    const err = new Error("Outside your state");
    err.status = 403;
    throw err;
  }
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
];

function mapBase(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  return {
    ...p,
    id: p.reference_id,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    zone: p.zone
      ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
      : undefined,
    state: p.state
      ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
      : undefined,
  };
}

function makeCrud({ Model, prefix, parseBody, mapExtra, uniquePeriod, mergeOnConflict }) {
  async function findReport(referenceId) {
    return Model.findByPk(referenceId, { include: reportIncludes });
  }

  const listReports = async (req, res, next) => {
    try {
      const where = {};
      applyScope(where, req.user, req.query);
      if (req.query.year || req.query.reporting_year) {
        where.reporting_year = Number(req.query.year || req.query.reporting_year);
      }
      if (req.query.month || req.query.reporting_month) {
        where.reporting_month = Number(req.query.month || req.query.reporting_month);
      }
      if (req.query.quarter || req.query.reporting_quarter) {
        where.reporting_quarter = Number(req.query.quarter || req.query.reporting_quarter);
      }
      if (req.query.status) where.status = req.query.status;
      if (req.query.service_type) where.service_type = req.query.service_type;

      const rows = await Model.findAll({
        where,
        include: reportIncludes,
        order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["reference_id", "DESC"]],
      });
      res.json({ success: true, data: rows.map((r) => mapExtra(mapBase(r))) });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const row = await findReport(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: "Report not found" });
      assertScope(req.user, row);
      res.json({ success: true, data: mapExtra(mapBase(row)) });
    } catch (err) { next(err); }
  };

  const createReport = async (req, res, next) => {
    try {
      const body = req.body || {};
      const geo = geoFromBody(req.user, body);
      if (!geo.zonal_code || !geo.state_code) {
        return res.status(422).json({ success: false, message: "Zone and state are required" });
      }
      const reporting_year = Number(body.reporting_year);
      let reporting_month = Number(body.reporting_month);
      let reporting_quarter = numOrNull(body.reporting_quarter);
      if (reporting_quarter) {
        reporting_month = monthFromQuarter(reporting_quarter);
      } else if (reporting_month) {
        reporting_quarter = quarterFromMonth(reporting_month);
      }
      if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
        return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
      }

      const status = body.status || "draft";
      if (status === "approved") {
        return res.status(422).json({
          success: false,
          message: "Send the report for review. Final approval follows the state coordinator's endorsement.",
        });
      }

      const fields = parseBody(body);
      const periodQuarter = reporting_quarter || quarterFromMonth(reporting_month);

      if (uniquePeriod) {
        const existing = await Model.findOne({
          where: {
            zonal_code: geo.zonal_code,
            state_code: geo.state_code,
            reporting_year,
            reporting_quarter: periodQuarter,
          },
        });
        if (existing) {
          // SSHIA: merge a new (empty) sub-head into the same-period report;
          // reject if that sub-head is already recorded for the quarter.
          if (mergeOnConflict) {
            assertScope(req.user, existing);
            const prefixLabels = {
              cap: "Capitation",
              ffs: "Fee-for-Service",
              reserve: "Reserve Funds",
              admin: "Admin. Charges",
            };
            const sshiaPrefixes = ["cap", "ffs", "reserve", "admin"];
            const touched = sshiaPrefixes.filter((key) => (
              Object.prototype.hasOwnProperty.call(fields, `${key}_opening_balance`)
              || Object.prototype.hasOwnProperty.call(fields, `${key}_receipts`)
              || Object.prototype.hasOwnProperty.call(fields, `${key}_actual_expenditure`)
              || Object.prototype.hasOwnProperty.call(fields, `${key}_bhcpf_lives`)
            ));
            for (const key of touched) {
              const already = existing[`${key}_opening_balance`] != null
                || existing[`${key}_receipts`] != null
                || existing[`${key}_actual_expenditure`] != null
                || existing[`${key}_bhcpf_lives`] != null;
              if (already) {
                return res.status(409).json({
                  success: false,
                  message: `${prefixLabels[key] || "This sub-head"} is already recorded for this quarter. Open the existing report to update it.`,
                  data: { reference_id: existing.reference_id },
                });
              }
            }
            const nextStatus = existing.status === "approved"
              ? existing.status
              : (status || existing.status);
            await existing.update({
              ...fields,
              submission_date: body.submission_date !== undefined
                ? body.submission_date
                : existing.submission_date,
              submitted_by: body.submitted_by !== undefined
                ? body.submitted_by
                : existing.submitted_by,
              status: nextStatus,
            });
            const full = await findReport(existing.reference_id);
            return res.json({ success: true, data: mapExtra(mapBase(full)), merged: true });
          }
          return res.status(409).json({
            success: false,
            message: "A report already exists for this office and period. Open it to edit.",
            data: { reference_id: existing.reference_id },
          });
        }
      }

      const reference_id = await nextReferenceId(Model, prefix);
      const report = await Model.create({
        reference_id,
        ...geo,
        reporting_year,
        reporting_month,
        ...(Model.rawAttributes.reporting_quarter
          ? { reporting_quarter: periodQuarter }
          : {}),
        ...(Model.rawAttributes.quarter
          ? { quarter: quarterFromMonth(reporting_month) }
          : {}),
        submission_date: body.submission_date || null,
        submitted_by: body.submitted_by || req.user?.name || null,
        status,
        ...fields,
        created_by_user_id: req.user?.id || null,
      });

      const full = await findReport(report.reference_id);
      res.status(201).json({ success: true, data: mapExtra(mapBase(full)) });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      if (err.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "A report already exists for this office and period" });
      }
      next(err);
    }
  };

  const updateReport = async (req, res, next) => {
    try {
      const report = await Model.findByPk(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      assertScope(req.user, report);

      const body = req.body || {};
      const geo = geoFromBody(req.user, body);
      const reporting_year = body.reporting_year != null
        ? Number(body.reporting_year) : report.reporting_year;
      let reporting_month = body.reporting_month != null
        ? Number(body.reporting_month) : report.reporting_month;
      let reporting_quarter = body.reporting_quarter != null
        ? Number(body.reporting_quarter)
        : (report.reporting_quarter || quarterFromMonth(reporting_month));
      if (body.reporting_quarter != null) {
        reporting_month = monthFromQuarter(reporting_quarter);
      } else if (body.reporting_month != null) {
        reporting_quarter = quarterFromMonth(reporting_month);
      }

      const fields = parseBody(body);
      await report.update({
        zonal_code: geo.zonal_code || report.zonal_code,
        state_code: geo.state_code || report.state_code,
        department_code: geo.department_code ?? report.department_code,
        unit_code: geo.unit_code ?? report.unit_code,
        reporting_year,
        reporting_month,
        ...(Model.rawAttributes.reporting_quarter ? { reporting_quarter } : {}),
        ...(Model.rawAttributes.quarter ? { quarter: quarterFromMonth(reporting_month) } : {}),
        submission_date: body.submission_date !== undefined ? body.submission_date : report.submission_date,
        submitted_by: body.submitted_by !== undefined ? body.submitted_by : report.submitted_by,
        status: body.status || report.status,
        ...fields,
      });

      const full = await findReport(report.reference_id);
      res.json({ success: true, data: mapExtra(mapBase(full)) });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await Model.findByPk(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      assertScope(req.user, report);
      const { status, review_note, action } = req.body || {};
      if (!status) {
        return res.status(422).json({ success: false, message: "status is required" });
      }
      const patch = { status };
      if (action === "endorse" || status === "approved") {
        patch.coordinator_reviewed_by = req.user?.name || req.user?.staff_id || null;
        patch.coordinator_reviewed_at = new Date();
        if (review_note) patch.coordinator_review_note = review_note;
      } else if (review_note) {
        patch.coordinator_review_note = review_note;
      }
      await report.update(patch);
      const full = await findReport(report.reference_id);
      res.json({ success: true, data: mapExtra(mapBase(full)) });
    } catch (err) { next(err); }
  };

  return { listReports, getReport, createReport, updateReport, updateStatus };
}

/* ─── IGR ─────────────────────────────────────────────────────────────── */

const IGR_SERVICES = new Set([
  "gifship",
  "nin_charge",
  "enrollee_update",
  "application_accreditation",
  "extra_dependent",
  "additional_dependent",
  "change_of_hcf",
  // legacy aliases still accepted
  "application",
  "accreditation",
  "reaccreditation",
  "change_of_provider",
  "extra_dependant",
  "ops",
]);

function parseIgrBody(body = {}) {
  const src = Array.isArray(body.lines) && body.lines[0] ? body.lines[0] : body;
  const service_type = String(src.service_type || "").trim();
  if (!service_type || !IGR_SERVICES.has(service_type)) {
    const err = new Error("Select a valid IGR service type");
    err.status = 422;
    throw err;
  }
  const principal_name = String(src.principal_name || "").trim();
  const receipt_no = String(src.receipt_no || "").trim();
  if (!src.entry_date) {
    const err = new Error("Entry date is required");
    err.status = 422;
    throw err;
  }
  if (!principal_name) {
    const err = new Error("Name of principal is required");
    err.status = 422;
    throw err;
  }
  if (!receipt_no) {
    const err = new Error("Receipt number is required");
    err.status = 422;
    throw err;
  }
  return {
    entry_date: src.entry_date,
    service_type,
    principal_name,
    receipt_no,
    bill_rrr_no: src.bill_rrr_no ? String(src.bill_rrr_no).trim() : null,
    nin_charge: numOrNull(src.nin_charge),
    amount: requireAmount(src.amount, "Amount"),
    payment_date: src.payment_date || null,
    remarks: src.remarks || null,
  };
}

function mapIgr(base) {
  return {
    ...base,
    lines: [{
      id: `${base.reference_id}-1`,
      report_id: base.reference_id,
      entry_date: base.entry_date,
      service_type: base.service_type,
      principal_name: base.principal_name,
      receipt_no: base.receipt_no,
      bill_rrr_no: base.bill_rrr_no,
      nin_charge: base.nin_charge,
      amount: base.amount,
      payment_date: base.payment_date,
      remarks: base.remarks,
      quarter: base.quarter,
    }],
  };
}

/* ─── SSHIA ───────────────────────────────────────────────────────────── */

const SSHIA_KEYS = ["cap", "ffs", "reserve", "admin"];

function parseSshiaBody(body = {}) {
  const out = {};
  if (Object.prototype.hasOwnProperty.call(body, "remarks")) {
    out.remarks = body.remarks || null;
  }
  // Only touch columns present in the body so one sub-head can be saved
  // without wiping the others on the same period report.
  for (const key of SSHIA_KEYS) {
    for (const field of ["opening_balance", "receipts", "actual_expenditure", "bhcpf_lives"]) {
      const col = `${key}_${field}`;
      if (Object.prototype.hasOwnProperty.call(body, col)) {
        out[col] = numOrNull(body[col]);
      }
    }
  }
  // Also accept lines[] shape from older FE during transition
  if (Array.isArray(body.lines) && body.lines.length) {
    const map = {
      capitation: "cap",
      fee_for_service: "ffs",
      reserve_funds: "reserve",
      admin_charge: "admin",
    };
    for (const line of body.lines) {
      const prefix = map[line.sub_head];
      if (!prefix) continue;
      out[`${prefix}_opening_balance`] = numOrNull(line.opening_balance);
      out[`${prefix}_receipts`] = numOrNull(line.receipts);
      out[`${prefix}_actual_expenditure`] = numOrNull(line.actual_expenditure);
      out[`${prefix}_bhcpf_lives`] = numOrNull(line.bhcpf_lives ?? line.covered_bhcpf_lives);
    }
  }
  return out;
}

function sshiaDerived(prefix, row) {
  const A = row[`${prefix}_opening_balance`];
  const B = row[`${prefix}_receipts`];
  const D = row[`${prefix}_actual_expenditure`];
  const hasAB = A != null || B != null;
  const C = hasAB ? Number(A || 0) + Number(B || 0) : null;
  const E = C != null && D != null ? C - Number(D) : (C != null ? C : null);
  // Variance = actual expenditure as % of total available (D÷C×100)
  let F = null;
  if (C != null && D != null && Number(C) !== 0) F = (Number(D) / Number(C)) * 100;
  return {
    opening_balance: A,
    receipts: B,
    total_budget: C,
    actual_expenditure: D,
    balance: E,
    variance_pct: F,
    bhcpf_lives: row[`${prefix}_bhcpf_lives`],
  };
}

function mapSshia(base) {
  const labels = [
    { key: "cap", sub_head: "capitation" },
    { key: "ffs", sub_head: "fee_for_service" },
    { key: "reserve", sub_head: "reserve_funds" },
    { key: "admin", sub_head: "admin_charge" },
  ];
  const lines = labels
    .map(({ key, sub_head }, i) => {
      const derived = sshiaDerived(key, base);
      const hasData = derived.opening_balance != null
        || derived.receipts != null
        || derived.actual_expenditure != null
        || derived.bhcpf_lives != null;
      if (!hasData) return null;
      return {
        id: `${base.reference_id}-${i + 1}`,
        report_id: base.reference_id,
        sub_head,
        ...derived,
        quarter: base.reporting_quarter,
      };
    })
    .filter(Boolean);
  return { ...base, lines };
}

/* ─── Expenditure ─────────────────────────────────────────────────────── */

const EXP_FIELDS = [
  "fuel_lubricants",
  "newspapers_periodicals",
  "entertainment_hospitality",
  "telephone_postages",
  "printing_stationery",
  "transport_travel",
  "maintenance_vehicles",
  "maintenance_equipment",
  "utilities_bank_charges",
];

const EXP_LEGACY_MAP = {
  fuel_lub: "fuel_lubricants",
  newspapers_periodicals: "newspapers_periodicals",
  ent_hosp: "entertainment_hospitality",
  tel_postages: "telephone_postages",
  printing_stationery: "printing_stationery",
  transport_travel: "transport_travel",
  maint_veh: "maintenance_vehicles",
  maint_equip: "maintenance_equipment",
  utilities: "utilities_bank_charges",
  bank_charges: "utilities_bank_charges",
  utilities_bank_charges: "utilities_bank_charges",
};

function parseExpenditureBody(body = {}) {
  const out = { remarks: body.remarks || null };
  for (const f of EXP_FIELDS) out[f] = numOrNull(body[f]);
  if (Array.isArray(body.lines) && body.lines.length) {
    for (const line of body.lines) {
      const field = EXP_LEGACY_MAP[line.sub_head] || line.sub_head;
      if (EXP_FIELDS.includes(field)) out[field] = numOrNull(line.amount);
    }
  }
  return out;
}

function mapExpenditure(base) {
  const lines = EXP_FIELDS.map((field, i) => ({
    id: `${base.reference_id}-${i + 1}`,
    report_id: base.reference_id,
    sub_head: field,
    amount: base[field],
    quarter: base.reporting_quarter,
  }));
  return { ...base, lines };
}

const igr = makeCrud({
  Model: FinanceIgrReport,
  prefix: "IGR",
  parseBody: parseIgrBody,
  mapExtra: mapIgr,
  uniquePeriod: false,
});

const sshia = makeCrud({
  Model: FinanceSshiaReport,
  prefix: "SSHIA",
  parseBody: parseSshiaBody,
  mapExtra: mapSshia,
  uniquePeriod: true,
  mergeOnConflict: true,
});

const expenditure = makeCrud({
  Model: FinanceExpenditureProfile,
  prefix: "EXPND",
  parseBody: parseExpenditureBody,
  mapExtra: mapExpenditure,
  uniquePeriod: true,
});

module.exports = {
  igr,
  sshia,
  expenditure,
  SSHIA_KEYS,
  EXP_FIELDS,
  sshiaDerived,
};
