const sequelize = require("../config/database");
const {
  ZonalOffice, StateOffice, StateOfficeHmoIndebtedness, StateOfficeHmoIndebtednessLine,
} = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeHmoIndebtedness.count({ transaction: t });
  return `HID-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeAll = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
  { model: StateOfficeHmoIndebtednessLine, as: "lines" },
];

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const mapLines = (sheetId, lines = []) =>
  (Array.isArray(lines) ? lines : [])
    .filter((l) => String(l.hmo_name || "").trim() && String(l.facility_name || "").trim())
    .map((l, i) => {
      const nhia_cap = money(l.nhia_cap);
      const nhia_ffs = money(l.nhia_ffs);
      const phi = money(l.phi);
      return {
        sheet_id: sheetId,
        hmo_name: String(l.hmo_name).trim(),
        facility_name: String(l.facility_name).trim(),
        hcf_code: l.hcf_code ? String(l.hcf_code).trim() : null,
        nhia_cap,
        nhia_ffs,
        phi,
        total: money(nhia_cap + nhia_ffs + phi),
        sort_order: i + 1,
      };
    });

const listSheets = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const rows = await StateOfficeHmoIndebtedness.findAll({
      where,
      include: includeAll,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSheet = async (req, res, next) => {
  try {
    const row = await StateOfficeHmoIndebtedness.findByPk(req.params.id, { include: includeAll });
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
    const row = await StateOfficeHmoIndebtedness.create({
      reference_id, zone_id, state_id,
      reporting_year, reporting_month,
      submitted_by: submitted_by || req.user?.full_name || "State Office",
      status,
    }, { transaction: t });
    const mapped = mapLines(row.id, lines);
    if (mapped.length) {
      await StateOfficeHmoIndebtednessLine.bulkCreate(mapped, { transaction: t });
    }
    await t.commit();
    const full = await StateOfficeHmoIndebtedness.findByPk(row.id, { include: includeAll });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateSheet = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const row = await StateOfficeHmoIndebtedness.findByPk(req.params.id, { transaction: t });
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
    await StateOfficeHmoIndebtednessLine.destroy({ where: { sheet_id: row.id }, transaction: t });
    const mapped = mapLines(row.id, scoped.lines);
    if (mapped.length) {
      await StateOfficeHmoIndebtednessLine.bulkCreate(mapped, { transaction: t });
    }
    await t.commit();
    const full = await StateOfficeHmoIndebtedness.findByPk(row.id, { include: includeAll });
    res.json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = { listSheets, getSheet, createSheet, updateSheet };
