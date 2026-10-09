const sequelize = require("../config/database");
const { ZonalOffice, StateOffice, StateOfficeWeeklyCompliance: Model } = require("../models");
const {
  buildStateOfficeListWhere, withCoordinatorTeam, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const EDITABLE = [
  "zone_id", "state_id", "reporting_week", "facility_id", "facility_name", "nhia_code",
  "facility_type", "facility_type_other", "facility_address", "compliance_officer",
  "designation_staff_id", "submission_date", "indicators", "status", "submitted_by",
];

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await Model.count({ transaction: t });
  return `WCR-${year}-${String(count + 1).padStart(5, "0")}`;
};

/** ISO week "2026-W41" → { year, month } of that week's Monday. */
function periodFromWeek(week) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(week || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const wk = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7);
  return { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1 };
}

function pickEditable(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  if (out.facility_type && out.facility_type !== "Other") out.facility_type_other = null;
  return out;
}

const listRecords = async (req, res, next) => {
  try {
    const where = await withCoordinatorTeam(req.user, await buildStateOfficeListWhere(req.user, req.query), Model);
    const rows = await Model.findAll({
      where,
      include: includeGeo,
      order: [["reporting_week", "DESC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getRecord = async (req, res, next) => {
  try {
    const row = await Model.findByPk(req.params.id, { include: includeGeo });
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const createRecord = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const data = pickEditable(scoped);
    const period = periodFromWeek(data.reporting_week);
    if (!period) {
      await t.rollback();
      return res.status(422).json({ success: false, message: "Valid reporting week is required" });
    }
    const row = await Model.create({
      ...data,
      reference_id: await genRefId(t),
      reporting_year: period.year,
      reporting_month: period.month,
      submitted_by: data.submitted_by || req.user?.name || "State Office",
      status: data.status || "submitted",
    }, { transaction: t });
    await t.commit();
    const full = await Model.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateRecord = async (req, res, next) => {
  try {
    const row = await Model.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    const data = pickEditable(scoped);
    if (data.reporting_week) {
      const period = periodFromWeek(data.reporting_week);
      if (!period) return res.status(422).json({ success: false, message: "Valid reporting week is required" });
      data.reporting_year = period.year;
      data.reporting_month = period.month;
    }
    await row.update(data);
    const full = await Model.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: full });
  } catch (err) { next(err); }
};

module.exports = { listRecords, getRecord, createRecord, updateRecord };
