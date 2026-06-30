const sequelize = require("../config/database");
const { ZonalOffice, StateOffice, StateOfficeComplaint } = require("../models");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeComplaint.count({ transaction: t });
  return `SOC-${year}-${String(count + 1).padStart(5, "0")}`;
};

const buildWhere = (query) => {
  const where = {};
  if (query.zone_id) where.zone_id = query.zone_id;
  if (query.state_id) where.state_id = query.state_id;
  if (query.year) where.reporting_year = query.year;
  if (query.month) where.reporting_month = query.month;
  if (query.against_type) where.against_type = query.against_type;
  if (query.status) where.status = query.status;
  return where;
};

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const listComplaints = async (req, res, next) => {
  try {
    const rows = await StateOfficeComplaint.findAll({
      where: buildWhere(req.query),
      include: includeGeo,
      order: [["complaint_date", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSummary = async (req, res, next) => {
  try {
    const where = buildWhere(req.query);
    const rows = await StateOfficeComplaint.findAll({ where, attributes: ["against_type", "status"] });

    const summaryMap = { against_hmo: 0, against_hcp: 0 };
    const statusMap = { resolved: 0, unresolved: 0, pending: 0, escalated: 0 };

    rows.forEach((r) => {
      if (summaryMap[r.against_type] !== undefined) summaryMap[r.against_type] += 1;
      if (statusMap[r.status] !== undefined) statusMap[r.status] += 1;
    });

    res.json({
      success: true,
      data: {
        summary: [
          { against_type: "against_hmo", count: summaryMap.against_hmo },
          { against_type: "against_hcp", count: summaryMap.against_hcp },
        ],
        status: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
        total_complaints: rows.length,
      },
    });
  } catch (err) { next(err); }
};

const createComplaint = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      zone_id, state_id, against_type, entity_name, entity_code,
      complaint_date, description, status = "pending",
      assigned_officer, resolution_notes, resolution_date,
      reporting_year, reporting_month, created_by,
    } = req.body;

    const date = complaint_date ? new Date(complaint_date) : new Date();
    const year = reporting_year || date.getFullYear();
    const month = reporting_month || (date.getMonth() + 1);

    const complaint_number = await genRefId(t);
    const row = await StateOfficeComplaint.create({
      complaint_number, zone_id, state_id,
      reporting_year: year, reporting_month: month,
      against_type, entity_name, entity_code, complaint_date,
      description, status, assigned_officer,
      resolution_notes, resolution_date,
      created_by: created_by || "State Office",
    }, { transaction: t });

    await t.commit();
    const full = await StateOfficeComplaint.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateComplaint = async (req, res, next) => {
  try {
    const row = await StateOfficeComplaint.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    await row.update(req.body);
    const full = await StateOfficeComplaint.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: full });
  } catch (err) { next(err); }
};

const getComplaint = async (req, res, next) => {
  try {
    const row = await StateOfficeComplaint.findByPk(req.params.id, { include: includeGeo });
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

module.exports = {
  listComplaints, getSummary, createComplaint, updateComplaint, getComplaint,
};
