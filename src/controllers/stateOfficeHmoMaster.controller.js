const sequelize = require("../config/database");
const {
  ZonalOffice, StateOffice,
  StateOfficeHmoMasterSheet, StateOfficeHmoMasterLine,
  StateOfficeHmoIndebtedness, StateOfficeHmoIndebtednessLine,
  StateOfficeHmoReconSheet, StateOfficeHmoReconLine,
} = require("../models");
const {
  buildStateOfficeListWhere, withCoordinatorTeam, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeHmoMasterSheet.count({ transaction: t });
  return `HIM-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeAll = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
  { model: StateOfficeHmoMasterLine, as: "lines" },
];

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const mapLines = (sheetId, lines = []) =>
  (Array.isArray(lines) ? lines : [])
    .filter((l) => String(l.hmo_name || "").trim() && String(l.facility_name || "").trim())
    .map((l, i) => {
      const alleged_cap = money(l.alleged_cap);
      const alleged_ffs = money(l.alleged_ffs);
      const alleged_phi = money(l.alleged_phi);
      const alleged_total = money(l.alleged_total != null && l.alleged_total !== ""
        ? l.alleged_total
        : alleged_cap + alleged_ffs + alleged_phi);
      const actual_cap = money(l.actual_cap);
      const actual_ffs = money(l.actual_ffs);
      const actual_phi = money(l.actual_phi);
      const actual_total = money(l.actual_total != null && l.actual_total !== ""
        ? l.actual_total
        : actual_cap + actual_ffs + actual_phi);
      const agreed_amount = money(l.agreed_amount);
      const amount_paid = money(l.amount_paid);
      const outstanding = l.outstanding != null && l.outstanding !== ""
        ? money(l.outstanding)
        : money(agreed_amount - amount_paid);
      return {
        sheet_id: sheetId,
        hmo_name: String(l.hmo_name).trim(),
        facility_name: String(l.facility_name).trim(),
        hcf_code: l.hcf_code ? String(l.hcf_code).trim() : null,
        alleged_cap, alleged_ffs, alleged_phi, alleged_total,
        actual_cap, actual_ffs, actual_phi, actual_total,
        agreed_amount, amount_paid, outstanding,
        remarks: l.remarks ? String(l.remarks).trim() : null,
        sort_order: i + 1,
      };
    });

const listSheets = async (req, res, next) => {
  try {
    const where = await withCoordinatorTeam(
      req.user,
      await buildStateOfficeListWhere(req.user, req.query),
      StateOfficeHmoMasterSheet,
    );
    const rows = await StateOfficeHmoMasterSheet.findAll({
      where,
      include: includeAll,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSheet = async (req, res, next) => {
  try {
    const row = await StateOfficeHmoMasterSheet.findByPk(req.params.id, { include: includeAll });
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const data = row.toJSON();
    if (Array.isArray(data.lines)) {
      data.lines.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createSheet = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const {
      zone_id, state_id, reporting_year, reporting_month, lines = [],
      submitted_by, status = "submitted",
    } = scoped;
    const reference_id = await genRefId(t);
    const row = await StateOfficeHmoMasterSheet.create({
      reference_id, zone_id, state_id,
      reporting_year, reporting_month,
      submitted_by: submitted_by || req.user?.full_name || "State Office",
      status,
    }, { transaction: t });
    const mapped = mapLines(row.id, lines);
    if (mapped.length) {
      await StateOfficeHmoMasterLine.bulkCreate(mapped, { transaction: t });
    }
    await t.commit();
    const full = await StateOfficeHmoMasterSheet.findByPk(row.id, { include: includeAll });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateSheet = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const row = await StateOfficeHmoMasterSheet.findByPk(req.params.id, { transaction: t });
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      await t.rollback();
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    await row.update({
      zone_id: scoped.zone_id,
      state_id: scoped.state_id,
      reporting_year: scoped.reporting_year,
      reporting_month: scoped.reporting_month,
      submitted_by: scoped.submitted_by,
      status: scoped.status || row.status,
    }, { transaction: t });
    await StateOfficeHmoMasterLine.destroy({ where: { sheet_id: row.id }, transaction: t });
    const mapped = mapLines(row.id, scoped.lines);
    if (mapped.length) {
      await StateOfficeHmoMasterLine.bulkCreate(mapped, { transaction: t });
    }
    await t.commit();
    const full = await StateOfficeHmoMasterSheet.findByPk(row.id, { include: includeAll });
    res.json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const normName = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const latestSheet = (sheets, keyOf) => {
  const picked = new Map();
  for (const sheet of sheets) {
    const key = keyOf(sheet);
    const prev = picked.get(key);
    const prevAt = prev ? new Date(prev.created_at || prev.createdAt || 0).getTime() : -1;
    const nextAt = new Date(sheet.created_at || sheet.createdAt || 0).getTime();
    if (!prev || nextAt >= prevAt) picked.set(key, sheet);
  }
  return [...picked.values()];
};

/** Collation holds alleged amounts. Reconciliation sheets hold actual, agreed, and paid. */
function buildMasterGroups(collationSheets, reconSheets) {
  const periods = new Map();

  const periodOf = (sheet) => {
    const key = `${sheet.state_id}|${sheet.reporting_year}|${sheet.reporting_month}`;
    if (!periods.has(key)) {
      periods.set(key, {
        state_id: sheet.state_id,
        state_name: sheet.state?.description ?? null,
        zone_name: sheet.zone?.description ?? null,
        reporting_year: Number(sheet.reporting_year),
        reporting_month: Number(sheet.reporting_month),
        rows: new Map(),
      });
    }
    return periods.get(key);
  };

  const touch = (period, hmo, facility, code) => {
    const hmoName = String(hmo || "").trim() || "Unassigned HMO";
    const facilityName = String(facility || "").trim();
    const hcfCode = code ? String(code).trim() : "";
    const nameKey = `${normName(hmoName)}|n|${normName(facilityName)}`;
    const codeKey = hcfCode ? `${normName(hmoName)}|c|${normName(hcfCode)}` : "";
    let row = (codeKey && period.rows.get(codeKey)) || period.rows.get(nameKey);
    if (!row) {
      row = {
        hmo_name: hmoName,
        facility_name: facilityName,
        hcf_code: hcfCode,
        alleged_cap: 0,
        alleged_ffs: 0,
        alleged_phi: 0,
        actual_cap: null,
        actual_ffs: null,
        actual_phi: null,
        agreed_amount: 0,
        amount_paid: 0,
        has_recon: false,
        remarks: [],
      };
    }
    if (facilityName) row.facility_name = facilityName;
    if (hcfCode) row.hcf_code = hcfCode;
    period.rows.set(`${normName(row.hmo_name)}|n|${normName(row.facility_name)}`, row);
    if (row.hcf_code) period.rows.set(`${normName(row.hmo_name)}|c|${normName(row.hcf_code)}`, row);
    return row;
  };

  for (const sheet of latestSheet(collationSheets, (s) => `${s.state_id}|${s.reporting_year}|${s.reporting_month}`)) {
    const period = periodOf(sheet);
    for (const line of sheet.lines || []) {
      if (!String(line.facility_name || "").trim() && !String(line.hmo_name || "").trim()) continue;
      const row = touch(period, line.hmo_name, line.facility_name, line.hcf_code);
      row.alleged_cap = money(line.nhia_cap);
      row.alleged_ffs = money(line.nhia_ffs);
      row.alleged_phi = money(line.phi);
    }
  }

  const reconLatest = latestSheet(
    reconSheets,
    (s) => `${s.state_id}|${s.reporting_year}|${s.reporting_month}|${s.stream_type}|${normName(s.hmo_name)}`,
  );
  for (const sheet of reconLatest) {
    const stream = sheet.stream_type;
    if (!["cap", "ffs", "phi"].includes(stream)) continue;
    const period = periodOf(sheet);
    for (const line of sheet.lines || []) {
      if (!String(line.hcf_name || "").trim()) continue;
      const row = touch(period, sheet.hmo_name, line.hcf_name, line.hcf_code);
      const allegedKey = `alleged_${stream}`;
      if (!row[allegedKey]) row[allegedKey] = money(line.alleged_amount);
      row[`actual_${stream}`] = money(line.actual_amount);
      if (!row.has_recon) {
        row.agreed_amount = 0;
        row.amount_paid = 0;
        row.has_recon = true;
      }
      row.agreed_amount = money(row.agreed_amount + money(line.agreed_amount));
      row.amount_paid = money(row.amount_paid + money(line.amount_paid));
      const remark = String(line.remarks || "").trim();
      if (remark && !row.remarks.includes(remark)) row.remarks.push(remark);
    }
  }

  return [...periods.values()]
    .map((period) => {
      const lines = [...new Set(period.rows.values())].map((row) => {
        const alleged_total = money(row.alleged_cap + row.alleged_ffs + row.alleged_phi);
        const actualParts = [row.actual_cap, row.actual_ffs, row.actual_phi].filter((v) => v != null);
        const actual_total = actualParts.length ? money(actualParts.reduce((sum, v) => sum + v, 0)) : null;
        const outstanding = row.has_recon ? money(row.agreed_amount - row.amount_paid) : null;
        return {
          hmo_name: row.hmo_name,
          facility_name: row.facility_name,
          hcf_code: row.hcf_code || null,
          alleged_cap: row.alleged_cap,
          alleged_ffs: row.alleged_ffs,
          alleged_phi: row.alleged_phi,
          alleged_total,
          actual_cap: row.actual_cap,
          actual_ffs: row.actual_ffs,
          actual_phi: row.actual_phi,
          actual_total,
          agreed_amount: row.has_recon ? row.agreed_amount : null,
          amount_paid: row.has_recon ? row.amount_paid : null,
          outstanding,
          remarks: row.remarks.join(" · ") || null,
        };
      }).sort((a, b) => a.hmo_name.localeCompare(b.hmo_name) || a.facility_name.localeCompare(b.facility_name));

      const hmos = [];
      for (const line of lines) {
        let group = hmos.find((h) => h.hmo_name === line.hmo_name);
        if (!group) {
          group = { hmo_name: line.hmo_name, lines: [] };
          hmos.push(group);
        }
        group.lines.push(line);
      }
      return {
        state_id: period.state_id,
        state_name: period.state_name,
        zone_name: period.zone_name,
        reporting_year: period.reporting_year,
        reporting_month: period.reporting_month,
        hmos,
      };
    })
    .filter((period) => period.hmos.length)
    .sort((a, b) => b.reporting_year - a.reporting_year || b.reporting_month - a.reporting_month || String(a.state_name || "").localeCompare(String(b.state_name || "")));
}

const geoInclude = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const compileMaster = async (req, res, next) => {
  try {
    const baseWhere = await buildStateOfficeListWhere(req.user, req.query);
    const collationWhere = await withCoordinatorTeam(req.user, baseWhere, StateOfficeHmoIndebtedness);
    const reconWhere = await withCoordinatorTeam(req.user, { ...baseWhere }, StateOfficeHmoReconSheet);
    const [collationSheets, reconSheets] = await Promise.all([
      StateOfficeHmoIndebtedness.findAll({
        where: collationWhere,
        include: [...geoInclude, { model: StateOfficeHmoIndebtednessLine, as: "lines" }],
      }),
      StateOfficeHmoReconSheet.findAll({
        where: reconWhere,
        include: [...geoInclude, { model: StateOfficeHmoReconLine, as: "lines" }],
      }),
    ]);
    const groups = buildMasterGroups(
      collationSheets.map((row) => row.toJSON()),
      reconSheets.map((row) => row.toJSON()),
    );
    res.json({ success: true, data: groups });
  } catch (err) { next(err); }
};

module.exports = { listSheets, getSheet, createSheet, updateSheet, compileMaster, buildMasterGroups };
