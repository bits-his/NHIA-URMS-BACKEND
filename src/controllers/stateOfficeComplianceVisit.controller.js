const sequelize = require("../config/database");
const { ZonalOffice, StateOffice, StateOfficeComplianceVisit } = require("../models");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeComplianceVisit.count({ transaction: t });
  return `SCV-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const buildWhere = (query) => {
  const where = {};
  if (query.zone_id) where.zone_id = query.zone_id;
  if (query.state_id) where.state_id = query.state_id;
  if (query.year) where.reporting_year = query.year;
  if (query.month) where.reporting_month = query.month;
  if (query.status) where.status = query.status;
  return where;
};

const listVisits = async (req, res, next) => {
  try {
    const rows = await StateOfficeComplianceVisit.findAll({
      where: buildWhere(req.query),
      include: includeGeo,
      order: [["visit_date", "DESC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getVisit = async (req, res, next) => {
  try {
    const row = await StateOfficeComplianceVisit.findByPk(req.params.id, { include: includeGeo });
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const createVisit = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      zone_id, state_id, facility_visited, visit_date,
      purpose, outcome, submitted_by, status = "submitted",
      reporting_year, reporting_month,
    } = req.body;

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
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    await row.update(req.body);
    const full = await StateOfficeComplianceVisit.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: full });
  } catch (err) { next(err); }
};

module.exports = { listVisits, getVisit, createVisit, updateVisit };
