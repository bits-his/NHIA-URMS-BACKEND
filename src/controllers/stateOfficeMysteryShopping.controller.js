const sequelize = require("../config/database");
const { ZonalOffice, StateOffice, StateOfficeMysteryShopping } = require("../models");
const {
  buildStateOfficeListWhere, assertRecordAccess, applyScopeToBody,
} = require("../utils/stateOfficeScope");
const { computeScores } = require("../utils/mysteryShoppingScore");

const genRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StateOfficeMysteryShopping.count({ transaction: t });
  return `MSS-${year}-${String(count + 1).padStart(5, "0")}`;
};

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
];

const pickFields = (body = {}) => ({
  zone_id: body.zone_id,
  state_id: body.state_id,
  reporting_year: body.reporting_year,
  reporting_month: body.reporting_month,
  email: body.email,
  mystery_shopper_name: body.mystery_shopper_name,
  facility_name: body.facility_name,
  facility_nhia_code: body.facility_nhia_code,
  facility_type: body.facility_type || null,
  facility_email: body.facility_email,
  visit_date: body.visit_date || null,
  observations: body.observations || {},
  enrollee_card_1: body.enrollee_card_1 || {},
  enrollee_card_2: body.enrollee_card_2 || {},
  enrollee_card_3: body.enrollee_card_3 || {},
  key_strengths: body.key_strengths,
  gaps_identified: body.gaps_identified,
  recommendation: body.recommendation,
  follow_up_action_plan: body.follow_up_action_plan,
  submitted_by: body.submitted_by,
  status: body.status,
});

const listVisits = async (req, res, next) => {
  try {
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const rows = await StateOfficeMysteryShopping.findAll({
      where,
      include: includeGeo,
      order: [["visit_date", "DESC"], ["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getVisit = async (req, res, next) => {
  try {
    const row = await StateOfficeMysteryShopping.findByPk(req.params.id, { include: includeGeo });
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
    const fields = pickFields(scoped);
    const date = fields.visit_date ? new Date(fields.visit_date) : new Date();
    const scores = computeScores(fields);
    const reference_id = await genRefId(t);
    const row = await StateOfficeMysteryShopping.create({
      ...fields,
      ...scores,
      reference_id,
      reporting_year: fields.reporting_year || date.getFullYear(),
      reporting_month: fields.reporting_month || (date.getMonth() + 1),
      submitted_by: fields.submitted_by || req.user?.full_name || "State Office",
      status: fields.status || "submitted",
    }, { transaction: t });

    await t.commit();
    const full = await StateOfficeMysteryShopping.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateVisit = async (req, res, next) => {
  try {
    const row = await StateOfficeMysteryShopping.findByPk(req.params.id);
    const access = await assertRecordAccess(req.user, row);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const scoped = await applyScopeToBody(req.user, req.body);
    const fields = pickFields(scoped);
    const scores = computeScores(fields);
    await row.update({ ...fields, ...scores });
    const full = await StateOfficeMysteryShopping.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: full });
  } catch (err) { next(err); }
};

module.exports = { listVisits, getVisit, createVisit, updateVisit };
