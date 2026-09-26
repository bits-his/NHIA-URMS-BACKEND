const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  MonitoringVisit, ServicomAssessmentIndicator, ServicomAssessmentScore,
  ServicomKpiRecord, ServicomComplaint, ServicomComplaintComment, ServicomSatisfactionSurvey, ServicomCommentCard,
  ServicomFinding, ServicomRecommendation,
  ServicomEvidence, ServicomAuditLog, ServicomFacility,
  ZonalOffice, StateOffice, User, Department, Unit,
} = require("../models");
const { buildServicomListWhere, applyComplaintExtraFilters } = require("../utils/servicomScope");
const { computeAssessmentScores, computeKpiMetrics } = require("../utils/servicomScoring");
const { computeComplaintMetrics, pickComplaintFields, enrichComplaintCodes, buildAssigneeWhere, buildCreatedOrAssignedWhere, isStateCoordinatorRole, isReportingOfficerRole } = require("../utils/complaintRegister");
const { nextComplaintNumber, previewComplaintNumber, monthYearParts } = require("../utils/complaintNumber");
const { notifyOfficerLabel } = require("../utils/notify");
const {
  loadComplaintSlaRules,
  enrichComplaintWithSla,
  listComplaintSlaRulesFormatted,
} = require("../utils/complaintSla");

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

async function genRefId(Model, prefix, t, field) {
  const year = new Date().getFullYear();
  const idField =
    field ||
    (Model.rawAttributes?.complaint_number ? "complaint_number" : "reference_id");
  const pattern = `${prefix}-${year}-`;
  const rows = await Model.findAll({
    attributes: [idField],
    where: { [idField]: { [Op.like]: `${pattern}%` } },
    transaction: t,
    lock: t?.LOCK?.UPDATE,
  });

  let maxSeq = 0;
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  for (const row of rows) {
    const match = String(row.get(idField) || "").match(re);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(5, "0")}`;
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

function emptyStatePerformanceBucket(stateId) {
  return {
    state_id: stateId,
    surveys: 0,
    surveyScoreSum: 0,
    surveyCount: 0,
    comment_cards: 0,
    cardScoreSum: 0,
    cardCount: 0,
    complaints: 0,
    complaintsClosed: 0,
  };
}

function computeStatePerformanceScore(bucket) {
  // Rankings require at least one survey or charter card (service-quality input)
  if (bucket.surveyCount === 0 && bucket.cardCount === 0) return null;

  const parts = [];
  if (bucket.surveyCount > 0) {
    parts.push({ value: bucket.surveyScoreSum / bucket.surveyCount, weight: 0.55 });
  }
  if (bucket.cardCount > 0) {
    parts.push({ value: (bucket.cardScoreSum / bucket.cardCount / 5) * 100, weight: 0.35 });
  }
  if (bucket.complaints > 0) {
    parts.push({
      value: (bucket.complaintsClosed / bucket.complaints) * 100,
      weight: 0.1,
    });
  }
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  const score = parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weightSum;
  return Math.round(score * 10) / 10;
}

function normalizeComplaintStatus(raw) {
  const key = String(raw || "unknown").trim().toLowerCase().replace(/\s+/g, "_");
  const map = {
    resolved: "Resolved",
    closed: "Closed",
    open: "Open",
    in_progress: "In Progress",
    assigned: "Assigned",
    escalated: "Escalated",
    "new/acknowledged": "New/Acknowledged",
    new_acknowledged: "New/Acknowledged",
  };
  return map[key] || String(raw || "Unknown").trim() || "Unknown";
}

function isComplaintClosed(c) {
  const status = String(c.status || "").toLowerCase();
  return status === "closed" || status === "resolved" || !!c.date_closed || !!c.resolution_date;
}

/** Top half = best performers; bottom half = low performers (no overlap). */
function splitTopLowPerformingStates(ranked) {
  const withScores = ranked.filter((s) => s.avg_score != null);
  if (!withScores.length) return { top_states: [], low_states: [] };
  if (withScores.length === 1) {
    return { top_states: [withScores[0]], low_states: [] };
  }
  const splitAt = Math.ceil(withScores.length / 2);
  const top_states = withScores.slice(0, Math.min(5, splitAt));
  const low_states = [...withScores.slice(splitAt)]
    .sort((a, b) => a.avg_score - b.avg_score)
    .slice(0, 5);
  return { top_states, low_states };
}

function buildStatePerformanceRankings(satisfactionSurveys, commentCards, complaints, stateNameById) {
  const stateMap = {};

  for (const s of satisfactionSurveys) {
    if (!s.state_id) continue;
    if (!stateMap[s.state_id]) stateMap[s.state_id] = emptyStatePerformanceBucket(s.state_id);
    stateMap[s.state_id].surveys += 1;
    if (s.percentage_score != null && !Number.isNaN(Number(s.percentage_score))) {
      stateMap[s.state_id].surveyScoreSum += Number(s.percentage_score);
      stateMap[s.state_id].surveyCount += 1;
    }
  }

  for (const c of commentCards) {
    if (!c.state_id) continue;
    if (!stateMap[c.state_id]) stateMap[c.state_id] = emptyStatePerformanceBucket(c.state_id);
    stateMap[c.state_id].comment_cards += 1;
    if (c.average_score != null && !Number.isNaN(Number(c.average_score))) {
      stateMap[c.state_id].cardScoreSum += Number(c.average_score);
      stateMap[c.state_id].cardCount += 1;
    }
  }

  for (const c of complaints) {
    if (!c.state_id) continue;
    if (!stateMap[c.state_id]) stateMap[c.state_id] = emptyStatePerformanceBucket(c.state_id);
    stateMap[c.state_id].complaints += 1;
    if (isComplaintClosed(c)) {
      stateMap[c.state_id].complaintsClosed += 1;
    }
  }

  return Object.values(stateMap)
    .map((bucket) => {
      const avg_score = computeStatePerformanceScore(bucket);
      return {
        state_id: bucket.state_id,
        state_name: stateNameById[bucket.state_id] ?? null,
        surveys: bucket.surveys,
        comment_cards: bucket.comment_cards,
        complaints: bucket.complaints,
        avg_score,
      };
    })
    .filter((s) => s.avg_score != null && (s.surveys > 0 || s.comment_cards > 0))
    .sort((a, b) => b.avg_score - a.avg_score);
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
  { id: "Q14", category: "PROFESSIONALISM" },
  { id: "Q15", category: "STAFF ATTITUDE" },
  { id: "Q16", category: "STAFF ATTITUDE" },
  { id: "Q17", category: "STAFF ATTITUDE" },
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

  listInvestigatingOfficers: async (req, res, next) => {
    try {
      const escalationLevel = String(req.query.escalation_level || "").trim();
      /** Registration "Assign To" — all active users. Escalation filters by level. */
      const assignMode = !escalationLevel;

      const and = [{ is_active: true }];
      if (req.query.q) {
        and.push({
          [Op.or]: [
            { name: { [Op.like]: `%${req.query.q}%` } },
            { staff_id: { [Op.like]: `%${req.query.q}%` } },
          ],
        });
      }

      const stateId = req.query.state_id || req.user?.state_id;
      const zoneId = req.query.zone_id || req.user?.zone_id;

      const enfDepts = await Department.findAll({
        where: {
          [Op.or]: [
            { department_code: { [Op.in]: ["ENF", "AUD"] } },
            { name: { [Op.like]: "%Enforcement%" } },
          ],
        },
        attributes: ["id"],
      });
      const enfDeptIds = enfDepts.map((d) => d.id);

      const enfUnitWhere = [
        { unit_code: { [Op.like]: "ENF%" } },
        { unit_code: "AUD-COMP" },
        { name: { [Op.like]: "%Enforcement%" } },
        { name: { [Op.like]: "%compliance & enforcement%" } },
      ];
      if (enfDeptIds.length) enfUnitWhere.push({ department_id: { [Op.in]: enfDeptIds } });

      const enfUnits = await Unit.findAll({
        where: { [Op.or]: enfUnitWhere },
        attributes: ["id"],
      });
      const enfUnitIds = enfUnits.map((u) => u.id);

      // Escalation: scope candidates by level geo
      if (!assignMode) {
        if (escalationLevel === "State Internal" && stateId) {
          and.push({ state_id: stateId });
        } else if (escalationLevel === "Zonal Office" && zoneId) {
          and.push({ zone_id: zoneId });
        }
        // NHIA Headquarters: no geo lock
      }

      const rows = await User.findAll({
        where: { [Op.and]: and },
        attributes: ["id", "name", "staff_id", "role", "functionalities", "department_id", "unit_id", "state_id", "zone_id"],
        include: [
          { model: Department, as: "department", attributes: ["id", "name", "department_code"], required: false },
          { model: Unit, as: "unit", attributes: ["id", "name", "unit_code"], required: false },
        ],
        order: [["name", "ASC"]],
        limit: 500,
      });

      const assignableRoles = new Set([
        "state-officer", "state-coordinator", "zonal-coordinator",
        "department-officer", "hq-department", "sdo", "admin", "reporting-officer",
      ]);

      const hasComplaintsAccess = (functionalities) => {
        let access = functionalities;
        if (typeof access === "string") {
          try { access = JSON.parse(access); } catch { access = []; }
        }
        if (!Array.isArray(access)) return false;
        return access.some((entry) => {
          const funcs = entry?.functionalities;
          return Array.isArray(funcs) && funcs.includes("Complaints Management");
        });
      };

      const isEnforcementDept = (u) => {
        if (enfDeptIds.includes(u.department_id)) return true;
        if (enfUnitIds.includes(u.unit_id)) return true;
        const deptCode = String(u.department?.department_code || "").toUpperCase();
        const unitCode = String(u.unit?.unit_code || "").toUpperCase();
        const deptName = String(u.department?.name || "").toLowerCase();
        const unitName = String(u.unit?.name || "").toLowerCase();
        if (deptCode === "AUD" || deptCode === "ENF") return true;
        if (unitCode === "AUD-COMP" || unitCode.startsWith("ENF")) return true;
        if (deptName.includes("enforcement") || unitName.includes("enforcement")) return true;
        if (unitName.includes("compliance & enforcement")) return true;
        return false;
      };

      const matchesEscalationLevel = (u) => {
        if (!escalationLevel) return true;
        if (escalationLevel === "State Internal") {
          return ["state-officer", "state-coordinator"].includes(u.role) || isEnforcementDept(u) || hasComplaintsAccess(u.functionalities);
        }
        if (escalationLevel === "Zonal Office") {
          return u.role === "zonal-coordinator" || isEnforcementDept(u) || hasComplaintsAccess(u.functionalities);
        }
        if (escalationLevel === "NHIA Headquarters") {
          return ["hq-department", "department-officer", "sdo", "admin"].includes(u.role) || isEnforcementDept(u);
        }
        return isEnforcementDept(u) || hasComplaintsAccess(u.functionalities);
      };

      const data = rows
        .map((row) => row.toJSON())
        .filter((u) => {
          // Assign To: every active user
          if (assignMode) return true;
          // Escalation: role/geo-appropriate candidates
          return (assignableRoles.has(u.role) || hasComplaintsAccess(u.functionalities) || isEnforcementDept(u))
            && matchesEscalationLevel(u);
        })
        .sort((a, b) => {
          const aEnf = isEnforcementDept(a) ? 0 : 1;
          const bEnf = isEnforcementDept(b) ? 0 : 1;
          if (aEnf !== bEnf) return aEnf - bEnf;
          return String(a.name || "").localeCompare(String(b.name || ""));
        })
        .map((u) => ({
          id: u.id,
          name: u.name,
          staff_id: u.staff_id,
          role: u.role,
          state_id: u.state_id ?? null,
          zone_id: u.zone_id ?? null,
          department: u.department?.name ?? null,
          department_code: u.department?.department_code ?? null,
          unit: u.unit?.name ?? null,
        }));

      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  previewComplaintNumber: async (req, res, next) => {
    try {
      const stateId = req.query.state_id || req.user?.state_id || null;
      const against = req.query.against || req.query.complaint_against || "HCF";
      const dateReceived = req.query.date_received || null;
      if (!stateId) {
        return res.json({
          success: true,
          data: { complaint_number: previewComplaintNumber(against, null, dateReceived) },
        });
      }
      const complaint_number = await nextComplaintNumber({
        against,
        stateId,
        dateReceived,
        sequelizeModel: ServicomComplaint,
      });
      res.json({ success: true, data: { complaint_number } });
    } catch (err) { next(err); }
  },

  listComplaints: async (req, res, next) => {
    try {
      const shared = {};
      if (req.query.status) shared.status = req.query.status;
      if (req.query.category) shared.complaint_category = req.query.category;
      if (req.query.priority) shared.priority_rating = req.query.priority;

      const geo = {};
      if (req.query.state_id) geo.state_id = req.query.state_id;
      if (req.query.zone_id) geo.zone_id = req.query.zone_id;

      const role = req.user?.role;
      const assignedOnly = req.query.assigned_to_me === "1" || req.query.assigned_to_me === "true";
      const mineOnly = req.query.mine === "1" || req.query.mine === "true";
      const assigneeWhere = buildAssigneeWhere(req.user, Op);
      const createdOrAssigned = buildCreatedOrAssignedWhere(req.user, Op);

      let where;
      if (isStateCoordinatorRole(role)) {
        // State coordinators see every complaint in their state (ignore assigned_to_me).
        const stateId = req.user?.state_id ?? geo.state_id ?? null;
        where = {
          ...shared,
          state_id: stateId != null ? stateId : -1,
        };
        if (req.user?.zone_id) where.zone_id = req.user.zone_id;
        else if (geo.zone_id) where.zone_id = geo.zone_id;
      } else if (isReportingOfficerRole(role) || mineOnly) {
        // Reporting officers: complaints they created OR that are assigned to them.
        if (!createdOrAssigned) {
          where = { ...shared, id: -1 };
        } else {
          where = { ...shared, ...createdOrAssigned };
        }
      } else if (assignedOnly && assigneeWhere) {
        where = { ...shared, ...assigneeWhere };
      } else if (assigneeWhere && Object.keys(geo).length) {
        where = { ...shared, [Op.or]: [geo, assigneeWhere] };
      } else {
        where = { ...shared, ...geo };
      }
      applyComplaintExtraFilters(where, req.query);
      const [rows, rulesMap] = await Promise.all([
        ServicomComplaint.findAll({
          where,
          include: [
            { model: StateOffice, as: "state", attributes: ["id", "description"] },
            { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
          ],
          order: [["date_received", "DESC"], ["complaint_date", "DESC"], ["created_at", "DESC"]],
        }),
        loadComplaintSlaRules(),
      ]);
      const data = await Promise.all(rows.map((r) => enrichComplaintWithSla(r, rulesMap)));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getComplaint: async (req, res, next) => {
    try {
      const [row, rulesMap] = await Promise.all([
        ServicomComplaint.findByPk(req.params.id, {
          include: [
            { model: StateOffice, as: "state", attributes: ["id", "description"] },
            { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
          ],
        }),
        loadComplaintSlaRules(),
      ]);
      if (!row) return res.status(404).json({ success: false, message: "Complaint not found" });
      res.json({ success: true, data: await enrichComplaintWithSla(row, rulesMap) });
    } catch (err) { next(err); }
  },

  listComplaintSla: async (req, res, next) => {
    try {
      const data = await listComplaintSlaRulesFormatted();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  createComplaint: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const state_id = req.body.state_id ?? req.user?.state_id ?? null;
      if (!state_id) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "State is required to generate a complaint ID" });
      }
      const dateReceived = req.body.date_received || req.body.complaint_date || null;
      const { month, year } = monthYearParts(dateReceived);
      const complaint_number = await nextComplaintNumber({
        against: req.body.complaint_against || req.body.complaint_type || "HCF",
        stateId: state_id,
        dateReceived,
        sequelizeModel: ServicomComplaint,
        transaction: t,
      });
      const metrics = await computeComplaintMetrics(req.body);
      const row = await ServicomComplaint.create({
        ...pickComplaintFields(req.body),
        ...enrichComplaintCodes(req.body),
        ...metrics,
        complaint_number,
        zone_id: req.body.zone_id ?? req.user?.zone_id ?? null,
        state_id,
        reporting_month: req.body.reporting_month ?? month,
        reporting_year: req.body.reporting_year ?? year,
        escalated: !!req.body.escalated,
        created_by: req.user?.name || null,
        created_by_staff_id: req.user?.staff_id || null,
      }, { transaction: t });
      await logAudit("servicom_complaint", row.id, "created", req.user?.name, null, t);
      await t.commit();
      if (row.officer_assigned) {
        await notifyOfficerLabel(row.officer_assigned, {
          title: "Complaint assigned to you",
          body: `${row.complaint_number || "A complaint"} has been assigned to you for investigation.`,
          type: "alert",
          link: "/sdo/servicom/complaints",
          entity_type: "servicom_complaint",
          entity_id: row.id,
        }).catch(() => {});
      }
      const rulesMap = await loadComplaintSlaRules(true);
      res.status(201).json({ success: true, data: await enrichComplaintWithSla(row, rulesMap) });
    } catch (err) { await t.rollback(); next(err); }
  },

  updateComplaint: async (req, res, next) => {
    try {
      const row = await ServicomComplaint.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: "Complaint not found" });
      const prevOfficer = row.officer_assigned || row.assigned_officer;
      const merged = { ...row.toJSON(), ...req.body };
      const metrics = await computeComplaintMetrics(merged);

      // Escalation hands the complaint to the escalation officer
      const becomingEscalated = req.body.escalated === true || req.body.escalated === "true" || req.body.escalated === 1;
      if (becomingEscalated && req.body.escalated_to) {
        metrics.officer_assigned = req.body.escalated_to;
        metrics.assigned_officer = req.body.escalated_to;
      }

      await row.update({
        ...pickComplaintFields(req.body),
        ...enrichComplaintCodes(merged),
        ...metrics,
        escalated: req.body.escalated !== undefined ? !!req.body.escalated : row.escalated,
      });
      await logAudit("servicom_complaint", row.id, "updated", req.user?.name, req.body);

      const nextOfficer = row.officer_assigned || row.assigned_officer;
      if (nextOfficer && nextOfficer !== prevOfficer) {
        await notifyOfficerLabel(nextOfficer, {
          title: becomingEscalated ? "Complaint escalated to you" : "Complaint assigned to you",
          body: becomingEscalated
            ? `${row.complaint_number || "A complaint"} was escalated to you (${req.body.escalation_level || "escalation"}). Immediate attention required.`
            : `${row.complaint_number || "A complaint"} has been assigned to you.`,
          type: becomingEscalated ? "directive" : "alert",
          link: "/sdo/servicom/complaints",
          entity_type: "servicom_complaint",
          entity_id: row.id,
        }).catch(() => {});
      }

      const rulesMap = await loadComplaintSlaRules(true);
      res.json({ success: true, data: await enrichComplaintWithSla(row, rulesMap) });
    } catch (err) { next(err); }
  },

  listComplaintComments: async (req, res, next) => {
    try {
      const complaint = await ServicomComplaint.findByPk(req.params.id, { attributes: ["id"] });
      if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });
      const data = await ServicomComplaintComment.findAll({
        where: { complaint_id: req.params.id },
        order: [["created_at", "ASC"]],
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  addComplaintComment: async (req, res, next) => {
    try {
      const body = String(req.body?.body ?? req.body?.comment ?? "").trim();
      if (!body) {
        return res.status(400).json({ success: false, message: "Comment is required" });
      }
      const complaint = await ServicomComplaint.findByPk(req.params.id, { attributes: ["id"] });
      if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });
      const row = await ServicomComplaintComment.create({
        complaint_id: complaint.id,
        body,
        created_by: req.user?.name || null,
        created_by_staff_id: req.user?.staff_id || null,
      });
      await logAudit("servicom_complaint", complaint.id, "comment_added", req.user?.name, { comment_id: row.id });
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  dashboard: async (req, res, next) => {
    try {
      const geoWhere = await buildServicomListWhere(req.user, {
        state_id: req.query.state_id,
        zone_id: req.query.zone_id,
      });

      const complaintWhere = applyComplaintExtraFilters({ ...geoWhere }, req.query);

      const [satisfactionSurveys, commentCards, complaints] = await Promise.all([
        ServicomSatisfactionSurvey.findAll({ where: geoWhere }),
        ServicomCommentCard.findAll({ where: geoWhere }),
        ServicomComplaint.findAll({ where: complaintWhere }),
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
      const complaints_closed = complaints.filter(isComplaintClosed).length;
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
          const k = normalizeComplaintStatus(c.status);
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      const complaint_by_category = Object.entries(
        complaints.reduce((acc, c) => {
          const k = (c.complaint_category || c.category || "Uncategorised")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (ch) => ch.toUpperCase());
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      const complaint_by_domain = Object.entries(
        complaints.reduce((acc, c) => {
          const k = c.complaint_domain || c.domain_code || "Not specified";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count);

      const complaint_by_priority = Object.entries(
        complaints.reduce((acc, c) => {
          const k = c.priority_rating || "Unrated";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([priority, count]) => ({ priority, count }))
        .sort((a, b) => b.count - a.count);

      const stateIds = [
        ...new Set([
          ...satisfactionSurveys.map((s) => s.state_id),
          ...commentCards.map((c) => c.state_id),
          ...complaints.map((c) => c.state_id),
        ].filter(Boolean)),
      ];
      const stateRows = stateIds.length
        ? await StateOffice.findAll({ where: { id: stateIds }, attributes: ["id", "description"] })
        : [];
      const stateNameById = Object.fromEntries(stateRows.map((st) => [st.id, st.description]));

      const state_satisfaction_rankings = buildStatePerformanceRankings(
        satisfactionSurveys,
        commentCards,
        complaints,
        stateNameById,
      );
      const { top_states, low_states } = splitTopLowPerformingStates(state_satisfaction_rankings);

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
          top_states,
          low_states,
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
      const where = await buildServicomListWhere(req.user, {
        state_id: req.query.state_id,
        zone_id: req.query.zone_id,
      });
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
      const where = await buildServicomListWhere(req.user, {
        state_id: req.query.state_id,
        zone_id: req.query.zone_id,
      });
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
      const state_id = req.body.state_id ?? req.user?.state_id ?? null;
      let zone_id = req.body.zone_id ?? req.user?.zone_id ?? null;
      if (state_id && !zone_id) {
        const state = await StateOffice.findByPk(state_id, { transaction: t });
        zone_id = state?.zone_id ?? null;
      }
      const row = await ServicomCommentCard.create({
        reference_id,
        zone_id,
        state_id,
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
      const state_id = req.body.state_id ?? row.state_id;
      let zone_id = req.body.zone_id ?? row.zone_id;
      if (req.body.state_id && !req.body.zone_id) {
        const state = await StateOffice.findByPk(state_id);
        zone_id = state?.zone_id ?? zone_id;
      }
      await row.update({
        zone_id,
        state_id,
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

  dashboardDrill: async (req, res, next) => {
    try {
      const { buildZoneBreakdown, buildStateBreakdownInZone } = require("../utils/dashboardDrillGeo");
      const segment = String(req.query.segment || "complaints");
      const recordSegment = req.query.record_segment || "complaints";
      const geoInclude = [
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
        { model: ZonalOffice, as: "zone", attributes: ["id", "description"] },
      ];

      const countServicomDrillRecord = async (query, rs) => {
        const q = { ...query };
        delete q.segment;
        delete q.record_segment;
        const where = await buildServicomListWhere(req.user, q);
        if (rs === "surveys") return ServicomSatisfactionSurvey.count({ where });
        if (rs === "comment_cards") return ServicomCommentCard.count({ where });
        if (rs === "visits") return MonitoringVisit.count({ where });
        if (query.status) where.status = query.status;
        if (query.category) where.complaint_category = query.category;
        if (query.domain) where.complaint_domain = query.domain;
        if (query.priority) where.priority_rating = query.priority;
        applyComplaintExtraFilters(where, query);
        if (query.month) {
          where[Op.or] = [
            { date_received: { [Op.like]: `${query.month}%` } },
            { complaint_date: { [Op.like]: `${query.month}%` } },
          ];
        }
        return ServicomComplaint.count({ where });
      };

      if (segment === "zone_breakdown") {
        const data = await buildZoneBreakdown((zoneId) =>
          countServicomDrillRecord({ ...req.query, zone_id: String(zoneId) }, recordSegment),
        );
        return res.json({ success: true, data });
      }

      if (segment === "state_breakdown") {
        const stateId = req.query.state_id;
        const zoneId = req.query.zone_id;
        if (!stateId && zoneId) {
          const data = await buildStateBreakdownInZone(zoneId, (stId) =>
            countServicomDrillRecord({ ...req.query, zone_id: String(zoneId), state_id: String(stId) }, recordSegment),
          );
          return res.json({ success: true, data });
        }
        if (!stateId) {
          return res.status(422).json({ success: false, message: "state_id or zone_id required" });
        }
      }

      const mapRow = (row, fields) => ({
        id: row.id,
        reference: fields.reference?.(row) ?? null,
        title: fields.title(row),
        subtitle: fields.subtitle?.(row) ?? null,
        status: fields.status?.(row) ?? null,
        date: fields.date?.(row) ?? null,
        state_name: row.state?.description ?? null,
        zone_name: row.zone?.description ?? null,
        state_id: row.state_id ?? row.state?.id ?? null,
        zone_id: row.zone_id ?? row.zone?.id ?? null,
        meta: fields.meta?.(row) ?? null,
      });

      if (segment === "surveys") {
        const where = await buildServicomListWhere(req.user, req.query);
        const rows = await ServicomSatisfactionSurvey.findAll({
          where,
          include: geoInclude,
          order: [["survey_date", "DESC"]],
          limit: 200,
        });
        return res.json({
          success: true,
          data: rows.map((r) => mapRow(r, {
            reference: (x) => x.reference_id,
            title: (x) => x.provider_name || "Satisfaction Survey",
            subtitle: (x) => x.team || x.survey_officers,
            status: (x) => (x.percentage_score != null ? `${x.percentage_score}% score` : null),
            date: (x) => x.survey_date,
            meta: (x) => x.survey_officers,
          })),
        });
      }

      if (segment === "comment_cards") {
        const where = await buildServicomListWhere(req.user, req.query);
        const rows = await ServicomCommentCard.findAll({
          where,
          include: geoInclude,
          order: [["card_date", "DESC"]],
          limit: 200,
        });
        return res.json({
          success: true,
          data: rows.map((r) => mapRow(r, {
            reference: (x) => x.reference_id,
            title: (x) => x.respondent_name || x.organisation || "Charter Comment Card",
            subtitle: (x) => x.organisation,
            status: (x) => (x.average_score != null ? `Score ${x.average_score}` : null),
            date: (x) => x.card_date,
          })),
        });
      }

      if (segment === "visits") {
        const where = await buildServicomListWhere(req.user, req.query);
        const rows = await MonitoringVisit.findAll({
          where,
          include: geoInclude,
          order: [["visit_date", "DESC"]],
          limit: 200,
        });
        return res.json({
          success: true,
          data: rows.map((r) => mapRow(r, {
            reference: (x) => x.reference_id,
            title: (x) => x.facility_name || "Monitoring Visit",
            subtitle: (x) => x.monitoring_type,
            status: (x) => x.status,
            date: (x) => x.visit_date,
            meta: (x) => x.compliance_rating,
          })),
        });
      }

      if (segment === "state_breakdown" && req.query.state_id) {
        const stateId = req.query.state_id;
        const q = { ...req.query, state_id: stateId };
        const [surveys, cards, complaints] = await Promise.all([
          ServicomSatisfactionSurvey.count({ where: await buildServicomListWhere(req.user, q) }),
          ServicomCommentCard.count({ where: await buildServicomListWhere(req.user, q) }),
          ServicomComplaint.count({ where: applyComplaintExtraFilters(await buildServicomListWhere(req.user, q), q) }),
        ]);
        const state = await StateOffice.findByPk(stateId, {
          attributes: ["description"],
          include: [{ model: ZonalOffice, as: "zone", attributes: ["description"] }],
        });
        return res.json({
          success: true,
          data: [
            { id: "surveys", reference: null, title: "Satisfaction Surveys", subtitle: state?.description, status: String(surveys), date: null, state_name: state?.description, zone_name: state?.zone?.description ?? null, meta: "segment:surveys" },
            { id: "cards", reference: null, title: "Charter Comment Cards", subtitle: state?.description, status: String(cards), date: null, state_name: state?.description, zone_name: state?.zone?.description ?? null, meta: "segment:comment_cards" },
            { id: "complaints", reference: null, title: "Complaints", subtitle: state?.description, status: String(complaints), date: null, state_name: state?.description, zone_name: state?.zone?.description ?? null, meta: "segment:complaints" },
          ],
        });
      }

      // default: complaints
      const where = await buildServicomListWhere(req.user, req.query);
      if (req.query.status) where.status = req.query.status;
      if (req.query.category) where.complaint_category = req.query.category;
      if (req.query.domain) where.complaint_domain = req.query.domain;
      if (req.query.priority) where.priority_rating = req.query.priority;
      applyComplaintExtraFilters(where, req.query);
      if (req.query.month) {
        where[Op.or] = [
          { date_received: { [Op.like]: `${req.query.month}%` } },
          { complaint_date: { [Op.like]: `${req.query.month}%` } },
        ];
      }
      const rows = await ServicomComplaint.findAll({
        where,
        include: geoInclude,
        order: [["date_received", "DESC"], ["complaint_date", "DESC"]],
        limit: 200,
      });
      res.json({
        success: true,
        data: rows.map((r) => mapRow(r, {
          reference: (x) => x.complaint_number,
          title: (x) => x.complainant_name || x.facility_name || x.complaint_category || "Complaint",
          subtitle: (x) => x.complaint_category || x.category,
          status: (x) => x.status,
          date: (x) => x.date_received || x.complaint_date,
          meta: (x) => x.complaint_domain,
        })),
      });
    } catch (err) { next(err); }
  },
};
