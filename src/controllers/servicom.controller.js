const path = require("path");
const fs = require("fs");
const sequelize = require("../config/database");
const {
  MonitoringVisit, ServicomAssessmentIndicator, ServicomAssessmentScore,
  ServicomKpiRecord, ServicomComplaint, ServicomFinding, ServicomRecommendation,
  ServicomEvidence, ServicomAuditLog, ServicomFacility,
  ZonalOffice, StateOffice,
} = require("../models");
const { buildServicomListWhere } = require("../utils/servicomScope");
const { computeAssessmentScores, computeKpiMetrics } = require("../utils/servicomScoring");

const VISIT_INCLUDES = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] },
  { model: StateOffice, as: "state", attributes: ["id", "description"] },
  { model: ServicomFacility, as: "facility", attributes: ["id", "name", "facility_type"] },
  {
    model: ServicomAssessmentScore, as: "scores",
    include: [{ model: ServicomAssessmentIndicator, as: "indicator", attributes: ["id", "key", "label"] }],
  },
  { model: ServicomKpiRecord, as: "kpi" },
  { model: ServicomFinding, as: "findings" },
  { model: ServicomRecommendation, as: "recommendations" },
  { model: ServicomEvidence, as: "evidence" },
];

async function genRefId(Model, prefix, t) {
  const year = new Date().getFullYear();
  const count = await Model.count({ transaction: t });
  return `${prefix}-${year}-${String(count + 1).padStart(5, "0")}`;
}

async function logAudit(entity_type, entity_id, action, actor, details, t) {
  await ServicomAuditLog.create({ entity_type, entity_id, action, actor, details }, { transaction: t });
}

async function replaceNested(visitId, body, t) {
  const scores = body.scores || [];
  const scoreValues = [];
  await ServicomAssessmentScore.destroy({ where: { visit_id: visitId }, transaction: t });
  for (const s of scores) {
    if (!s.indicator_id || !s.score) continue;
    await ServicomAssessmentScore.create(
      { visit_id: visitId, indicator_id: s.indicator_id, score: s.score },
      { transaction: t },
    );
    scoreValues.push(Number(s.score));
  }
  const assessment = computeAssessmentScores(scoreValues);
  await MonitoringVisit.update(assessment, { where: { id: visitId }, transaction: t });

  if (body.kpi) {
    const metrics = computeKpiMetrics(body.kpi);
    const kpiPayload = { visit_id: visitId, ...body.kpi, ...metrics };
    const existing = await ServicomKpiRecord.findOne({ where: { visit_id: visitId }, transaction: t });
    if (existing) await existing.update(kpiPayload, { transaction: t });
    else await ServicomKpiRecord.create(kpiPayload, { transaction: t });
  }

  await ServicomFinding.destroy({ where: { visit_id: visitId }, transaction: t });
  for (const f of body.findings || []) {
    if (!f.description) continue;
    await ServicomFinding.create(
      { visit_id: visitId, finding_type: f.finding_type, description: f.description },
      { transaction: t },
    );
  }

  await ServicomRecommendation.destroy({ where: { visit_id: visitId }, transaction: t });
  for (const r of body.recommendations || []) {
    if (!r.description) continue;
    await ServicomRecommendation.create(
      {
        visit_id: visitId,
        description: r.description,
        priority: r.priority || "medium",
        responsible_officer: r.responsible_officer || null,
        timeline: r.timeline || null,
        status: r.status || "open",
      },
      { transaction: t },
    );
  }
}

function pickVisitFields(body) {
  const fields = [
    "zone_id", "state_id", "facility_id", "lga", "facility_name", "facility_type",
    "address", "contact_person", "phone", "email", "visit_date", "monitoring_type",
    "monitoring_officer", "status", "submitted_by",
  ];
  const out = {};
  for (const k of fields) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

module.exports = {
  listIndicators: async (_req, res, next) => {
    try {
      const rows = await ServicomAssessmentIndicator.findAll({
        where: { is_active: true },
        order: [["sort_order", "ASC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  listVisits: async (req, res, next) => {
    try {
      const where = await buildServicomListWhere(req.user, req.query);
      const rows = await MonitoringVisit.findAll({
        where,
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
        ],
        order: [["visit_date", "DESC"], ["created_at", "DESC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  getVisit: async (req, res, next) => {
    try {
      const row = await MonitoringVisit.findByPk(req.params.id, { include: VISIT_INCLUDES });
      if (!row) return res.status(404).json({ success: false, message: "Visit not found" });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  createVisit: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const reference_id = await genRefId(MonitoringVisit, "SVC", t);
      const visit = await MonitoringVisit.create({
        reference_id,
        ...pickVisitFields(req.body),
        status: req.body.status || "draft",
        submitted_by: req.body.submitted_by || req.user?.name || null,
      }, { transaction: t });
      await replaceNested(visit.id, req.body, t);
      await logAudit("monitoring_visit", visit.id, "created", req.user?.name, null, t);
      await t.commit();
      const full = await MonitoringVisit.findByPk(visit.id, { include: VISIT_INCLUDES });
      res.status(201).json({ success: true, data: full });
    } catch (err) { await t.rollback(); next(err); }
  },

  updateVisit: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const visit = await MonitoringVisit.findByPk(req.params.id, { transaction: t });
      if (!visit) { await t.rollback(); return res.status(404).json({ success: false, message: "Visit not found" }); }
      if (!["draft", "returned"].includes(visit.status)) {
        await t.rollback();
        return res.status(403).json({ success: false, message: "Cannot edit a visit under review or approved" });
      }
      await visit.update(pickVisitFields(req.body), { transaction: t });
      await replaceNested(visit.id, req.body, t);
      await logAudit("monitoring_visit", visit.id, "updated", req.user?.name, null, t);
      await t.commit();
      const full = await MonitoringVisit.findByPk(visit.id, { include: VISIT_INCLUDES });
      res.json({ success: true, data: full });
    } catch (err) { await t.rollback(); next(err); }
  },

  submitVisit: async (req, res, next) => {
    try {
      const visit = await MonitoringVisit.findByPk(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });
      if (!["draft", "returned"].includes(visit.status)) {
        return res.status(422).json({ success: false, message: "Visit cannot be submitted in current status" });
      }
      await visit.update({ status: "submitted", submitted_by: req.user?.name || visit.submitted_by });
      await logAudit("monitoring_visit", visit.id, "submitted", req.user?.name, null);
      res.json({ success: true, data: visit });
    } catch (err) { next(err); }
  },

  reviewVisit: async (req, res, next) => {
    try {
      const visit = await MonitoringVisit.findByPk(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });
      if (visit.status !== "submitted") {
        return res.status(422).json({ success: false, message: "Only submitted visits can be reviewed" });
      }
      await visit.update({
        status: "reviewed",
        reviewed_by: req.user?.name,
        reviewed_at: new Date(),
        review_note: req.body.note || null,
      });
      await logAudit("monitoring_visit", visit.id, "reviewed", req.user?.name, { note: req.body.note });
      res.json({ success: true, data: visit });
    } catch (err) { next(err); }
  },

  approveVisit: async (req, res, next) => {
    try {
      const visit = await MonitoringVisit.findByPk(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });
      if (!["submitted", "reviewed"].includes(visit.status)) {
        return res.status(422).json({ success: false, message: "Visit cannot be approved in current status" });
      }
      await visit.update({
        status: "approved",
        approved_by: req.user?.name,
        approved_at: new Date(),
      });
      await logAudit("monitoring_visit", visit.id, "approved", req.user?.name, null);
      res.json({ success: true, data: visit });
    } catch (err) { next(err); }
  },

  returnVisit: async (req, res, next) => {
    try {
      const visit = await MonitoringVisit.findByPk(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });
      if (!["submitted", "reviewed"].includes(visit.status)) {
        return res.status(422).json({ success: false, message: "Visit cannot be returned in current status" });
      }
      await visit.update({
        status: "returned",
        returned_by: req.user?.name,
        returned_at: new Date(),
        return_reason: req.body.reason || null,
      });
      await logAudit("monitoring_visit", visit.id, "returned", req.user?.name, { reason: req.body.reason });
      res.json({ success: true, data: visit });
    } catch (err) { next(err); }
  },

  uploadEvidence: async (req, res, next) => {
    try {
      const visit = await MonitoringVisit.findByPk(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
      const row = await ServicomEvidence.create({
        visit_id: visit.id,
        file_name: req.file.originalname,
        file_path: `/uploads/servicom/${req.file.filename}`,
        file_type: path.extname(req.file.originalname).replace(".", ""),
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        description: req.body.description || null,
        uploaded_by: req.user?.name || null,
      });
      await logAudit("servicom_evidence", row.id, "uploaded", req.user?.name, { visit_id: visit.id });
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  listComplaints: async (req, res, next) => {
    try {
      const where = {};
      if (req.query.state_id) where.state_id = req.query.state_id;
      if (req.query.zone_id) where.zone_id = req.query.zone_id;
      if (req.query.status) where.status = req.query.status;
      if (req.query.category) where.category = req.query.category;
      const rows = await ServicomComplaint.findAll({
        where,
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
        order: [["complaint_date", "DESC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  createComplaint: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const complaint_number = await genRefId(ServicomComplaint, "CMP", t);
      const row = await ServicomComplaint.create({
        complaint_number,
        ...req.body,
        created_by: req.user?.name || null,
      }, { transaction: t });
      await logAudit("servicom_complaint", row.id, "created", req.user?.name, null, t);
      await t.commit();
      res.status(201).json({ success: true, data: row });
    } catch (err) { await t.rollback(); next(err); }
  },

  updateComplaint: async (req, res, next) => {
    try {
      const row = await ServicomComplaint.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: "Complaint not found" });
      await row.update(req.body);
      await logAudit("servicom_complaint", row.id, "updated", req.user?.name, req.body);
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  dashboard: async (req, res, next) => {
    try {
      const where = await buildServicomListWhere(req.user, req.query);
      const visits = await MonitoringVisit.findAll({
        where,
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
          { model: ServicomKpiRecord, as: "kpi" },
        ],
      });

      const total = visits.length;
      const approved = visits.filter((v) => v.status === "approved").length;
      const compliant = visits.filter((v) =>
        v.compliance_rating === "fully_compliant" || v.compliance_rating === "substantially_compliant",
      ).length;
      const national_compliance_rate = total
        ? Math.round((compliant / total) * 1000) / 10
        : 0;

      const stateMap = {};
      const zoneMap = {};
      for (const v of visits) {
        const sid = v.state_id;
        const zid = v.zone_id;
        if (sid) {
          if (!stateMap[sid]) stateMap[sid] = { state_id: sid, state: v.state?.description, total: 0, scoreSum: 0, count: 0 };
          stateMap[sid].total += 1;
          if (v.percentage_score != null) { stateMap[sid].scoreSum += Number(v.percentage_score); stateMap[sid].count += 1; }
        }
        if (zid) {
          if (!zoneMap[zid]) zoneMap[zid] = { zone_id: zid, zone: v.zone?.description, total: 0, scoreSum: 0, count: 0 };
          zoneMap[zid].total += 1;
          if (v.percentage_score != null) { zoneMap[zid].scoreSum += Number(v.percentage_score); zoneMap[zid].count += 1; }
        }
      }

      const state_rankings = Object.values(stateMap)
        .map((s) => ({ ...s, avg_score: s.count ? Math.round((s.scoreSum / s.count) * 10) / 10 : 0 }))
        .sort((a, b) => b.avg_score - a.avg_score);

      const zone_rankings = Object.values(zoneMap)
        .map((z) => ({ ...z, avg_score: z.count ? Math.round((z.scoreSum / z.count) * 10) / 10 : 0 }))
        .sort((a, b) => b.avg_score - a.avg_score);

      const complaints = await ServicomComplaint.findAll({ where: req.query.state_id ? { state_id: req.query.state_id } : {} });
      const complaints_received = complaints.length;
      const complaints_resolved = complaints.filter((c) => ["resolved", "closed"].includes(c.status)).length;
      const complaint_resolution_rate = complaints_received
        ? Math.round((complaints_resolved / complaints_received) * 1000) / 10
        : 0;

      const satisfactionScores = visits
        .map((v) => v.kpi?.beneficiary_satisfaction_rate)
        .filter((n) => n != null)
        .map(Number);
      const avg_satisfaction = satisfactionScores.length
        ? Math.round(satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length * 10) / 10
        : null;

      const monthlyMap = {};
      for (const v of visits) {
        const m = v.visit_date ? String(v.visit_date).slice(0, 7) : "unknown";
        monthlyMap[m] = (monthlyMap[m] || 0) + 1;
      }
      const monthly_assessments = Object.entries(monthlyMap)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const rating_distribution = ["fully_compliant", "substantially_compliant", "partially_compliant", "non_compliant"]
        .map((rating) => ({
          rating,
          count: visits.filter((v) => v.compliance_rating === rating).length,
        }));

      res.json({
        success: true,
        data: {
          total_assessments: total,
          approved_assessments: approved,
          national_compliance_rate,
          complaint_resolution_rate,
          avg_satisfaction,
          state_rankings,
          zone_rankings,
          top_states: state_rankings.slice(0, 5),
          low_states: [...state_rankings].reverse().slice(0, 5),
          monthly_assessments,
          rating_distribution,
          complaint_categories: Object.entries(
            complaints.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {}),
          ).map(([category, count]) => ({ category, count })),
        },
      });
    } catch (err) { next(err); }
  },

  listFacilities: async (req, res, next) => {
    try {
      const where = { is_active: true };
      if (req.query.state_id) where.state_id = req.query.state_id;
      if (req.query.zone_id) where.zone_id = req.query.zone_id;
      const rows = await ServicomFacility.findAll({
        where,
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
        order: [["name", "ASC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },
};
