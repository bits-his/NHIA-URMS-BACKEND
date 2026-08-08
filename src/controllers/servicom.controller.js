const path = require("path");
const fs = require("fs");
const sequelize = require("../config/database");
const {
  MonitoringVisit, ServicomAssessmentIndicator, ServicomAssessmentScore,
  ServicomKpiRecord, ServicomComplaint, ServicomSatisfactionSurvey, ServicomCommentCard,
  ServicomFinding, ServicomRecommendation,
  ServicomEvidence, ServicomAuditLog, ServicomFacility,
  ZonalOffice, StateOffice,
} = require("../models");
const { buildServicomListWhere } = require("../utils/servicomScope");
const { computeAssessmentScores, computeKpiMetrics } = require("../utils/servicomScoring");
const { computeComplaintMetrics, pickComplaintFields, enrichComplaintCodes } = require("../utils/complaintRegister");

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

function computeSatisfactionMetrics(responses) {
  const rows = Array.isArray(responses) ? responses : [];
  const total = rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  const max = rows.length;
  const percentage = max ? Math.round((total / max) * 1000) / 10 : 0;
  return { total_score: total, max_score: max, percentage_score: percentage };
}

function computeCommentCardMetrics(responses) {
  const rows = Array.isArray(responses) ? responses : [];
  const scored = rows.filter((r) => r.score != null && r.score !== "");
  const total = scored.reduce((sum, r) => sum + Number(r.score), 0);
  const average = scored.length ? Math.round((total / scored.length) * 100) / 100 : 0;
  return { total_score: total, average_score: average };
}

function normalizeSurveyResponses(raw, questions) {
  const map = new Map((Array.isArray(raw) ? raw : []).map((r) => [r.question_id, r]));
  return questions.map((q) => {
    const existing = map.get(q.id) || {};
    const response = existing.response ?? null;
    let score = existing.score;
    if (score == null && response === "yes") score = 1;
    if (score == null && response === "no") score = 0;
    if (score == null && response != null && response !== "") score = Number(response);
    return { question_id: q.id, category: existing.category || q.category || q.section, question: existing.question || q.question || null, response, score: score ?? null };
  });
}

function normalizeCommentResponses(raw, questions) {
  const map = new Map((Array.isArray(raw) ? raw : []).map((r) => [r.question_id, r]));
  return questions.map((q) => {
    const existing = map.get(q.id) || {};
    const response = existing.response ?? null;
    const score = response != null && response !== "" ? Number(response) : null;
    return { question_id: q.id, section: existing.section || q.section, question: existing.question || q.question || null, response, score };
  });
}

const SATISFACTION_QUESTIONS = [
  { id: "Q01", category: "SERVICE DELIVERY" },
  { id: "Q02", category: "SERVICE DELIVERY" },
  { id: "Q03", category: "SERVICE DELIVERY" },
  { id: "Q04", category: "SERVICE DELIVERY" },
  { id: "Q05", category: "SERVICE DELIVERY" },
  { id: "Q06", category: "TIMELINESS" },
  { id: "Q07", category: "TIMELINESS" },
  { id: "Q08", category: "TIMELINESS" },
  { id: "Q09", category: "TIMELINESS" },
  { id: "Q10", category: "INFORMATION" },
  { id: "Q11", category: "INFORMATION" },
  { id: "Q12", category: "PROFESSIONALISM" },
  { id: "Q13", category: "PROFESSIONALISM" },
];

const COMMENT_CARD_QUESTIONS = [
  { id: "Q01", section: "Reception" },
  { id: "Q02", section: "Front Desk Staff" },
  { id: "Q03", section: "Front Desk Staff" },
  { id: "Q04", section: "Front Desk Staff" },
  { id: "Q05", section: "Overall" },
];

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
      if (req.query.category) where.complaint_category = req.query.category;
      if (req.query.priority) where.priority_rating = req.query.priority;
      const rows = await ServicomComplaint.findAll({
        where,
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
        order: [["date_received", "DESC"], ["complaint_date", "DESC"], ["created_at", "DESC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  getComplaint: async (req, res, next) => {
    try {
      const row = await ServicomComplaint.findByPk(req.params.id, {
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: "Complaint not found" });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  createComplaint: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      let complaint_number = String(req.body.complaint_number || "").trim();
      if (complaint_number) {
        const existing = await ServicomComplaint.findOne({ where: { complaint_number }, transaction: t });
        if (existing) {
          await t.rollback();
          return res.status(400).json({ success: false, message: "Complaint ID already exists" });
        }
      } else {
        complaint_number = await genRefId(ServicomComplaint, "CMP", t);
      }
      const metrics = computeComplaintMetrics(req.body);
      const row = await ServicomComplaint.create({
        complaint_number,
        ...pickComplaintFields(req.body),
        ...enrichComplaintCodes(req.body),
        ...metrics,
        zone_id: req.body.zone_id ?? req.user?.zone_id ?? null,
        state_id: req.body.state_id ?? req.user?.state_id ?? null,
        reporting_year: req.body.reporting_year ?? new Date().getFullYear(),
        escalated: !!req.body.escalated,
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
      const merged = { ...row.toJSON(), ...req.body };
      const metrics = computeComplaintMetrics(merged);
      await row.update({
        ...pickComplaintFields(req.body),
        ...enrichComplaintCodes(merged),
        ...metrics,
        escalated: req.body.escalated !== undefined ? !!req.body.escalated : row.escalated,
      });
      await logAudit("servicom_complaint", row.id, "updated", req.user?.name, req.body);
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  dashboard: async (req, res, next) => {
    try {
      const geoWhere = {};
      if (req.query.state_id) geoWhere.state_id = req.query.state_id;
      if (req.query.zone_id) geoWhere.zone_id = req.query.zone_id;

      const [satisfactionSurveys, commentCards, complaints] = await Promise.all([
        ServicomSatisfactionSurvey.findAll({ where: geoWhere }),
        ServicomCommentCard.findAll({ where: geoWhere }),
        ServicomComplaint.findAll({ where: geoWhere }),
      ]);

      const surveyPctScores = satisfactionSurveys
        .map((s) => Number(s.percentage_score))
        .filter((n) => !Number.isNaN(n));
      const commentAvgScores = commentCards
        .map((c) => Number(c.average_score))
        .filter((n) => !Number.isNaN(n));

      const avg_satisfaction = surveyPctScores.length
        ? Math.round(surveyPctScores.reduce((a, b) => a + b, 0) / surveyPctScores.length * 10) / 10
        : null;
      const avg_comment_card_score = commentAvgScores.length
        ? Math.round(commentAvgScores.reduce((a, b) => a + b, 0) / commentAvgScores.length * 100) / 100
        : null;

      const complaints_received = complaints.length;
      const complaints_closed = complaints.filter((c) =>
        ["Closed", "Resolved", "closed", "resolved"].includes(c.status) || c.date_closed,
      ).length;
      const complaint_resolution_rate = complaints_received
        ? Math.round((complaints_closed / complaints_received) * 1000) / 10
        : 0;

      const slaTracked = complaints.filter((c) => c.resolution_within_sla != null);
      const sla_compliance_rate = slaTracked.length
        ? Math.round((slaTracked.filter((c) => c.resolution_within_sla).length / slaTracked.length) * 1000) / 10
        : null;

      const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0, 7) : null);
      const monthlyMap = {};
      const bump = (key, field) => {
        if (!key) return;
        if (!monthlyMap[key]) monthlyMap[key] = { month: key, surveys: 0, comment_cards: 0, complaints: 0 };
        monthlyMap[key][field] += 1;
      };
      satisfactionSurveys.forEach((s) => bump(monthKey(s.survey_date), "surveys"));
      commentCards.forEach((c) => bump(monthKey(c.card_date), "comment_cards"));
      complaints.forEach((c) => bump(monthKey(c.date_received || c.complaint_date), "complaints"));
      const monthly_activity = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

      const complaint_by_status = Object.entries(
        complaints.reduce((acc, c) => {
          const k = c.status || "Unknown";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      ).map(([status, count]) => ({ status, count }));

      const complaint_by_category = Object.entries(
        complaints.reduce((acc, c) => {
          const k = c.complaint_category || c.category || "Uncategorised";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      ).map(([category, count]) => ({ category, count }));

      const complaint_by_domain = Object.entries(
        complaints.reduce((acc, c) => {
          const k = c.complaint_domain || "Unknown";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      ).map(([domain, count]) => ({ domain, count }));

      const complaint_by_priority = Object.entries(
        complaints.reduce((acc, c) => {
          const k = c.priority_rating || "Unrated";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      ).map(([priority, count]) => ({ priority, count }));

      const stateMap = {};
      for (const s of satisfactionSurveys) {
        if (!s.state_id) continue;
        if (!stateMap[s.state_id]) stateMap[s.state_id] = { state_id: s.state_id, surveys: 0, scoreSum: 0, count: 0 };
        stateMap[s.state_id].surveys += 1;
        if (s.percentage_score != null) {
          stateMap[s.state_id].scoreSum += Number(s.percentage_score);
          stateMap[s.state_id].count += 1;
        }
      }
      const stateIds = Object.keys(stateMap);
      const stateRows = stateIds.length
        ? await StateOffice.findAll({ where: { id: stateIds }, attributes: ["id", "description"] })
        : [];
      const stateNameById = Object.fromEntries(stateRows.map((st) => [st.id, st.description]));
      const state_satisfaction_rankings = Object.values(stateMap)
        .map((s) => ({
          ...s,
          state_name: stateNameById[s.state_id] ?? null,
          avg_score: s.count ? Math.round((s.scoreSum / s.count) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.avg_score - a.avg_score);

      res.json({
        success: true,
        data: {
          satisfaction_surveys: satisfactionSurveys.length,
          comment_cards: commentCards.length,
          complaints_received,
          avg_satisfaction,
          avg_comment_card_score,
          complaint_resolution_rate,
          sla_compliance_rate,
          monthly_activity,
          complaint_by_status,
          complaint_by_category,
          complaint_by_domain,
          complaint_by_priority,
          state_satisfaction_rankings,
          top_states: state_satisfaction_rankings.slice(0, 5),
          low_states: [...state_satisfaction_rankings].reverse().slice(0, 5),
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

  listSatisfactionSurveys: async (req, res, next) => {
    try {
      const where = {};
      if (req.query.state_id) where.state_id = req.query.state_id;
      if (req.query.zone_id) where.zone_id = req.query.zone_id;
      const rows = await ServicomSatisfactionSurvey.findAll({
        where,
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
        order: [["survey_date", "DESC"], ["created_at", "DESC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  getSatisfactionSurvey: async (req, res, next) => {
    try {
      const row = await ServicomSatisfactionSurvey.findByPk(req.params.id, {
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: "Survey not found" });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  createSatisfactionSurvey: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const responses = normalizeSurveyResponses(req.body.responses, SATISFACTION_QUESTIONS);
      const metrics = computeSatisfactionMetrics(responses);
      let reference_id = String(req.body.reference_id || "").trim();
      if (reference_id) {
        const existing = await ServicomSatisfactionSurvey.findOne({ where: { reference_id }, transaction: t });
        if (existing) {
          await t.rollback();
          return res.status(400).json({ success: false, message: "Survey ID already exists" });
        }
      } else {
        reference_id = await genRefId(ServicomSatisfactionSurvey, "SAT", t);
      }
      const row = await ServicomSatisfactionSurvey.create({
        reference_id,
        zone_id: req.body.zone_id ?? req.user?.zone_id ?? null,
        state_id: req.body.state_id ?? req.user?.state_id ?? null,
        provider_name: req.body.provider_name,
        survey_date: req.body.survey_date,
        survey_officers: req.body.survey_officers ?? null,
        team: req.body.team ?? null,
        responses,
        ...metrics,
        created_by: req.user?.name || null,
      }, { transaction: t });
      await logAudit("servicom_satisfaction_survey", row.id, "created", req.user?.name, null, t);
      await t.commit();
      res.status(201).json({ success: true, data: row });
    } catch (err) { await t.rollback(); next(err); }
  },

  updateSatisfactionSurvey: async (req, res, next) => {
    try {
      const row = await ServicomSatisfactionSurvey.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: "Survey not found" });
      const responses = normalizeSurveyResponses(req.body.responses ?? row.responses, SATISFACTION_QUESTIONS);
      const metrics = computeSatisfactionMetrics(responses);
      await row.update({
        zone_id: req.body.zone_id ?? row.zone_id,
        state_id: req.body.state_id ?? row.state_id,
        provider_name: req.body.provider_name ?? row.provider_name,
        survey_date: req.body.survey_date ?? row.survey_date,
        survey_officers: req.body.survey_officers ?? row.survey_officers,
        team: req.body.team ?? row.team,
        responses,
        ...metrics,
      });
      await logAudit("servicom_satisfaction_survey", row.id, "updated", req.user?.name, req.body);
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  listCommentCards: async (req, res, next) => {
    try {
      const where = {};
      if (req.query.state_id) where.state_id = req.query.state_id;
      if (req.query.zone_id) where.zone_id = req.query.zone_id;
      const rows = await ServicomCommentCard.findAll({
        where,
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
        order: [["card_date", "DESC"], ["created_at", "DESC"]],
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  getCommentCard: async (req, res, next) => {
    try {
      const row = await ServicomCommentCard.findByPk(req.params.id, {
        include: [
          { model: StateOffice, as: "state", attributes: ["id", "description"] },
          { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: "Comment card not found" });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  createCommentCard: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const responses = normalizeCommentResponses(req.body.responses, COMMENT_CARD_QUESTIONS);
      const metrics = computeCommentCardMetrics(responses);
      let reference_id = String(req.body.reference_id || "").trim();
      if (reference_id) {
        const existing = await ServicomCommentCard.findOne({ where: { reference_id }, transaction: t });
        if (existing) {
          await t.rollback();
          return res.status(400).json({ success: false, message: "Response ID already exists" });
        }
      } else {
        reference_id = await genRefId(ServicomCommentCard, "CCC", t);
      }
      const row = await ServicomCommentCard.create({
        reference_id,
        zone_id: req.body.zone_id ?? req.user?.zone_id ?? null,
        state_id: req.body.state_id ?? req.user?.state_id ?? null,
        respondent_name: req.body.respondent_name ?? null,
        organisation: req.body.organisation ?? null,
        card_date: req.body.card_date,
        responses,
        ...metrics,
        created_by: req.user?.name || null,
      }, { transaction: t });
      await logAudit("servicom_comment_card", row.id, "created", req.user?.name, null, t);
      await t.commit();
      res.status(201).json({ success: true, data: row });
    } catch (err) { await t.rollback(); next(err); }
  },

  updateCommentCard: async (req, res, next) => {
    try {
      const row = await ServicomCommentCard.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: "Comment card not found" });
      const responses = normalizeCommentResponses(req.body.responses ?? row.responses, COMMENT_CARD_QUESTIONS);
      const metrics = computeCommentCardMetrics(responses);
      await row.update({
        zone_id: req.body.zone_id ?? row.zone_id,
        state_id: req.body.state_id ?? row.state_id,
        respondent_name: req.body.respondent_name ?? row.respondent_name,
        organisation: req.body.organisation ?? row.organisation,
        card_date: req.body.card_date ?? row.card_date,
        responses,
        ...metrics,
      });
      await logAudit("servicom_comment_card", row.id, "updated", req.user?.name, req.body);
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },
};
