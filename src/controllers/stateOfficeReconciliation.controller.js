const sequelize = require("../config/database");
const { ZonalOffice, StateOffice, StateOfficeReconciliationMeeting } = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeReconciliationMeeting.count({ transaction: t });
  return `SRM-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const listMeetings = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const rows = await StateOfficeReconciliationMeeting.findAll({
      where,
      include: includeGeo,
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createMeeting = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const {
      zone_id, state_id, hmo, hmo_code, facility, amount_owed,
      recon_status, comment, submitted_by, status = "submitted",
      reporting_year, reporting_month,
    } = scoped;

    const reference_id = await genRefId(t);
    const now = new Date();
    const row = await StateOfficeReconciliationMeeting.create({
      reference_id, zone_id, state_id,
      reporting_year: reporting_year || now.getFullYear(),
      reporting_month: reporting_month || (now.getMonth() + 1),
      hmo, hmo_code, facility,
      amount_owed: amount_owed ?? 0,
      recon_status, comment,
      submitted_by: submitted_by || "State Office",
      status,
    }, { transaction: t });

    await t.commit();
    const full = await StateOfficeReconciliationMeeting.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateMeeting = async (req, res, next) => {
  try {
    const row = await StateOfficeReconciliationMeeting.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    await row.update(scoped);
    const full = await StateOfficeReconciliationMeeting.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: full });
  } catch (err) { next(err); }
};

module.exports = { listMeetings, createMeeting, updateMeeting };
