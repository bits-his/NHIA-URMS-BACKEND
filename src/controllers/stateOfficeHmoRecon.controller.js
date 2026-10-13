const sequelize = require("../config/database");
const {
  ZonalOffice, StateOffice, StateOfficeHmoReconSheet, StateOfficeHmoReconLine,
} = require("../models");
const {
  buildStateOfficeListWhere, withCoordinatorTeam, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const STREAMS = new Set(["phi", "ffs", "cap"]);
const PREFIX = { phi: "HIP", ffs: "HIF", cap: "HIC" };

const genRefId = async (stream, t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeHmoReconSheet.count({
    where: { stream_type: stream },
    transaction: t,
  });
  return `${PREFIX[stream] || "HIR"}-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeAll = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
  { model: StateOfficeHmoReconLine, as: "lines" },
];

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const mapLines = (sheetId, lines = []) =>
  (Array.isArray(lines) ? lines : [])
    .filter((l) => String(l.hcf_name || "").trim())
    .map((l, i) => {
      const alleged_amount = money(l.alleged_amount);
      const actual_amount = money(l.actual_amount);
      const agreed_amount = money(l.agreed_amount);
      const amount_paid = money(l.amount_paid);
      const outstanding = l.outstanding != null && l.outstanding !== ""
        ? money(l.outstanding)
        : money(agreed_amount - amount_paid);
      return {
        sheet_id: sheetId,
        hcf_name: String(l.hcf_name).trim(),
        hcf_code: l.hcf_code ? String(l.hcf_code).trim() : null,
        alleged_amount,
        actual_amount,
        agreed_amount,
        amount_paid,
        outstanding,
        remarks: l.remarks ? String(l.remarks).trim() : null,
        sort_order: i + 1,
      };
    });

const resolveStream = (req) => {
  const stream = String(req.query.stream || req.body?.stream_type || "").toLowerCase();
  return STREAMS.has(stream) ? stream : null;
};

const listSheets = async (req, res, next) => {
  try {
    const stream = resolveStream(req);
    if (!stream) {
      return res.status(400).json({ success: false, message: "stream query (phi|ffs|cap) is required" });
    }
    const where = await withCoordinatorTeam(
      req.user,
      await buildStateOfficeListWhere(req.user, req.query),
      StateOfficeHmoReconSheet,
    );
    where.stream_type = stream;
    if (req.query.hmo) {
      where.hmo_name = String(req.query.hmo);
    }
    const rows = await StateOfficeHmoReconSheet.findAll({
      where,
      include: includeAll,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["hmo_name", "ASC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSheet = async (req, res, next) => {
  try {
    const row = await StateOfficeHmoReconSheet.findByPk(req.params.id, { include: includeAll });
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
    const stream = resolveStream(req);
    if (!stream) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "stream_type (phi|ffs|cap) is required" });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    const {
      zone_id, state_id, reporting_year, reporting_month, lines = [],
      hmo_name, hmo_code, submitted_by, status = "submitted",
    } = scoped;
    if (!String(hmo_name || "").trim()) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "HMO name is required" });
    }
    const reference_id = await genRefId(stream, t);
    const row = await StateOfficeHmoReconSheet.create({
      reference_id,
      stream_type: stream,
      zone_id, state_id,
      reporting_year, reporting_month,
      hmo_name: String(hmo_name).trim(),
      hmo_code: hmo_code ? String(hmo_code).trim() : null,
      submitted_by: submitted_by || req.user?.full_name || "State Office",
      status,
    }, { transaction: t });
    const mapped = mapLines(row.id, lines);
    if (mapped.length) {
      await StateOfficeHmoReconLine.bulkCreate(mapped, { transaction: t });
    }
    await t.commit();
    const full = await StateOfficeHmoReconSheet.findByPk(row.id, { include: includeAll });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateSheet = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const row = await StateOfficeHmoReconSheet.findByPk(req.params.id, { transaction: t });
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
      hmo_name: String(scoped.hmo_name || row.hmo_name).trim(),
      hmo_code: scoped.hmo_code != null ? (String(scoped.hmo_code).trim() || null) : row.hmo_code,
      submitted_by: scoped.submitted_by,
      status: scoped.status || row.status,
    }, { transaction: t });
    await StateOfficeHmoReconLine.destroy({ where: { sheet_id: row.id }, transaction: t });
    const mapped = mapLines(row.id, scoped.lines);
    if (mapped.length) {
      await StateOfficeHmoReconLine.bulkCreate(mapped, { transaction: t });
    }
    await t.commit();
    const full = await StateOfficeHmoReconSheet.findByPk(row.id, { include: includeAll });
    res.json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = { listSheets, getSheet, createSheet, updateSheet };
