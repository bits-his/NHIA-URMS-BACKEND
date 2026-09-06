const sequelize = require("../config/database");
const { ZonalOffice, StateOffice, StateOfficeComplianceVisit } = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeComplianceVisit.count({ transaction: t });
  return `SCV-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const listVisits = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const rows = await StateOfficeComplianceVisit.findAll({
      where,
      include: includeGeo,
      order: [["visit_date", "DESC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getVisit = async (req, res, next) => {
  try {
    const row = await StateOfficeComplianceVisit.findByPk(req.params.id, { include: includeGeo });
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const createVisit = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const scoped = await applyScopeToBody(req.user, req.body);
    const {
      zone_id, state_id, facility_visited, visit_date,
      purpose, outcome, submitted_by, status = "submitted",
      reporting_year, reporting_month,
    } = scoped;

    const date = visit_date ? new Date(visit_date) : new Date();
    const reference_id = await genRefId(t);
    const row = await StateOfficeComplianceVisit.create({
      reference_id, zone_id, state_id,
      reporting_year: reporting_year || date.getFullYear(),
      reporting_month: reporting_month || (date.getMonth() + 1),
      facility_visited, visit_date, purpose, outcome,
      submitted_by: submitted_by || "State Office",
      status,
    }, { transaction: t });

    await t.commit();
    const full = await StateOfficeComplianceVisit.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateVisit = async (req, res, next) => {
  try {
    const row = await StateOfficeComplianceVisit.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    await row.update(scoped);
    const full = await StateOfficeComplianceVisit.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: full });
  } catch (err) { next(err); }
};

module.exports = { listVisits, getVisit, createVisit, updateVisit };
