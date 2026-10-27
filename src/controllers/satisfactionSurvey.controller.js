const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  ServicomSatisfactionSurvey,
  ServicomSatisfactionSurveyResponse,
  StateOffice,
  ZonalOffice,
  Unit,
} = require("../models");

const DEFAULT_UNIT = "SVC-SAT";

/** Mirror of frontend SATISFACTION_QUESTIONS */
const SATISFACTION_QUESTIONS = [
  { id: "Q01", category: "SERVICE DELIVERY", question: "Are there physical or bureaucratic obstacles to access?" },
  { id: "Q02", category: "SERVICE DELIVERY", question: "Is the facility open for NHIS enrollees only during working hours?" },
  { id: "Q03", category: "SERVICE DELIVERY", question: "Does the HCF recognise poor performance?" },
  { id: "Q04", category: "SERVICE DELIVERY", question: "Does the HCF give honest explanation of the reasons for poor performance?" },
  { id: "Q05", category: "SERVICE DELIVERY", question: "Does the HCF take remedial action for poor performance?" },
  { id: "Q06", category: "TIMELINESS", question: "Are staff seen and perceived to provide prompt service?" },
  { id: "Q07", category: "TIMELINESS", question: "Is there any system in place to monitor waiting time?" },
  { id: "Q08", category: "TIMELINESS", question: "Is there reasonable explanation for delays that are not a regular occurrence?" },
  { id: "Q09", category: "TIMELINESS", question: "Are customers told of any unforeseen interruptions to service?" },
  { id: "Q10", category: "INFORMATION", question: "Does the healthcare facility publish the NHIS drug list?" },
  { id: "Q11", category: "INFORMATION", question: "Does the HCF give enrollees sufficient information with respect to referrals?" },
  { id: "Q12", category: "PROFESSIONALISM", question: "Are appointment procedures clearly detailed at all service points for enrollees to see?" },
  { id: "Q13", category: "PROFESSIONALISM", question: "Do hospital staff adhere to these procedures and give no unfair preference to certain customers?" },
  { id: "Q14", category: "PROFESSIONALISM", question: "Do staff adhere to procedures and there are no hidden costs to enrolees?" },
  { id: "Q15", category: "STAFF ATTITUDE", question: "How sympathetic are hospital staff to enrolee needs?" },
  { id: "Q16", category: "STAFF ATTITUDE", question: "Are staff polite, friendly and attentive to enrolees?" },
  { id: "Q17", category: "STAFF ATTITUDE", question: "Are suitable facilities for privacy available?" },
];

async function genRefId(t) {
  const year = new Date().getFullYear();
  const prefix = `SAT-${year}-`;
  const last = await ServicomSatisfactionSurvey.findOne({
    where: { reference_id: { [Op.like]: `${prefix}%` } },
    order: [["reference_id", "DESC"]],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(5, "0")}`;
}

function surveyPk(req) {
  return decodeURIComponent(String(req.params.id || "").trim());
}

function normalizeTeam(raw) {
  if (Array.isArray(raw)) {
    return raw.map((n) => String(n ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => String(n ?? "").trim()).filter(Boolean);
      }
    } catch { /* plain text */ }
    return raw.split(/[,;\n]/).map((n) => n.trim()).filter(Boolean);
  }
  return [];
}

function normalizeLines(rawResponses) {
  const byId = new Map();
  if (Array.isArray(rawResponses)) {
    for (const r of rawResponses) {
      if (r?.question_id) byId.set(String(r.question_id), r);
    }
  }
  const lines = [];
  for (const q of SATISFACTION_QUESTIONS) {
    const raw = byId.get(q.id) || {};
    const response = String(raw.response_value ?? raw.response ?? "").toLowerCase();
    const valid = response === "yes" || response === "no";
    const score = valid ? (response === "yes" ? 1 : 0) : null;
    lines.push({
      question_id: q.id,
      category: q.category,
      question_text: q.question,
      response_value: valid ? response : null,
      score,
    });
  }
  return lines;
}

function missingLines(lines) {
  return lines.filter((l) => l.response_value !== "yes" && l.response_value !== "no");
}

function computeMetrics(lines) {
  const scored = lines.filter((l) => l.score != null);
  const total = scored.reduce((sum, l) => sum + Number(l.score), 0);
  const max = SATISFACTION_QUESTIONS.length;
  const percentage = max ? Math.round((total / max) * 1000) / 10 : 0;
  return { total_score: total, max_score: max, percentage_score: percentage };
}

function surveyInclude() {
  return [
    { association: "zone", attributes: ["zonal_code", "description"] },
    { association: "state", attributes: ["code", "description", "zonal_code"] },
    { association: "unit", attributes: ["unit_code", "name"] },
    { association: "responses" },
    {
      association: "created_by_user",
      attributes: ["id", "name", "staff_id"],
      required: false,
    },
  ];
}

function serializeSurvey(row) {
  const data = row.toJSON ? row.toJSON() : row;
  const lines = Array.isArray(data.responses) ? data.responses : [];
  data.responses = lines
    .slice()
    .sort((a, b) => String(a.question_id).localeCompare(String(b.question_id)))
    .map((l) => ({
      question_id: l.question_id,
      category: l.category,
      question: l.question_text,
      response: l.response_value,
      score: l.score,
    }));
  if (typeof data.team === "string") {
    try { data.team = JSON.parse(data.team); } catch { data.team = []; }
  }
  if (!Array.isArray(data.team)) data.team = [];
  return data;
}

async function resolveGeo({ zonal_code, state_code, zone_id, state_id }, user) {
  let stateCode =
    state_code ||
    (state_id != null && state_id !== "" && !/^\d+$/.test(String(state_id)) ? String(state_id) : null) ||
    user?.state_code ||
    null;
  let zoneCode =
    zonal_code ||
    (zone_id != null && zone_id !== "" && !/^\d+$/.test(String(zone_id)) ? String(zone_id) : null) ||
    user?.zonal_code ||
    null;

  if (!stateCode) return { error: "state_code is required" };

  const state = await StateOffice.findByPk(stateCode);
  if (!state) return { error: "Invalid state_code" };

  if (!zoneCode) zoneCode = state.zonal_code;
  if (state.zonal_code !== zoneCode) {
    return { error: "state_code does not belong to zonal_code" };
  }

  const zone = await ZonalOffice.findByPk(zoneCode);
  if (!zone) return { error: "Invalid zonal_code" };

  return { state_code: state.code, zonal_code: zone.zonal_code };
}

async function resolveUnit(unit_code) {
  const code = unit_code || DEFAULT_UNIT;
  const unit = await Unit.findByPk(code);
  return unit ? unit.unit_code : null;
}

const listSatisfactionSurveys = async (req, res, next) => {
  try {
    const where = {};
    const zoneKey = req.query.zonal_code || req.query.zone_id;
    const stateKey = req.query.state_code || req.query.state_id;

    if (req.user?.state_code) {
      where.state_code = req.user.state_code;
    } else if (req.user?.zonal_code) {
      where.zonal_code = req.user.zonal_code;
      if (stateKey) where.state_code = stateKey;
    } else {
      if (zoneKey) where.zonal_code = zoneKey;
      if (stateKey) where.state_code = stateKey;
    }

    const rows = await ServicomSatisfactionSurvey.findAll({
      where,
      include: surveyInclude(),
      order: [["survey_date", "DESC"], ["createdAt", "DESC"]],
    });
    res.json({ success: true, data: rows.map(serializeSurvey) });
  } catch (err) {
    next(err);
  }
};

const getSatisfactionSurvey = async (req, res, next) => {
  try {
    const row = await ServicomSatisfactionSurvey.findByPk(surveyPk(req), { include: surveyInclude() });
    if (!row) return res.status(404).json({ success: false, message: "Satisfaction survey not found" });
    res.json({ success: true, data: serializeSurvey(row) });
  } catch (err) {
    next(err);
  }
};

const createSatisfactionSurvey = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const lines = normalizeLines(req.body.responses);
    if (missingLines(lines).length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "All questions are required" });
    }
    const metrics = computeMetrics(lines);

    const geo = await resolveGeo(req.body, req.user);
    if (geo.error) {
      await t.rollback();
      return res.status(400).json({ success: false, message: geo.error });
    }

    const provider_name = String(req.body.provider_name || "").trim();
    if (!provider_name) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "provider_name is required" });
    }
    if (!req.body.survey_date) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "survey_date is required" });
    }

    const reference_id = await genRefId(t);
    const unit_code = await resolveUnit(req.body.unit_code);
    const team = normalizeTeam(req.body.team);

    const row = await ServicomSatisfactionSurvey.create(
      {
        reference_id,
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        unit_code,
        provider_name,
        survey_date: req.body.survey_date,
        team,
        ...metrics,
        created_by_user_id: req.user?.id ?? null,
      },
      { transaction: t },
    );

    await ServicomSatisfactionSurveyResponse.bulkCreate(
      lines.map((l) => ({ ...l, reference_id: row.reference_id })),
      { transaction: t },
    );

    await t.commit();

    const full = await ServicomSatisfactionSurvey.findByPk(row.reference_id, { include: surveyInclude() });
    res.status(201).json({ success: true, data: serializeSurvey(full) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateSatisfactionSurvey = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const reference_id = surveyPk(req);
    const row = await ServicomSatisfactionSurvey.findByPk(reference_id, { transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Satisfaction survey not found" });
    }

    const lines = normalizeLines(req.body.responses);
    if (missingLines(lines).length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "All questions are required" });
    }
    const metrics = computeMetrics(lines);

    const geo = await resolveGeo(
      {
        zonal_code: req.body.zonal_code ?? row.zonal_code,
        state_code: req.body.state_code ?? row.state_code,
        zone_id: req.body.zone_id,
        state_id: req.body.state_id,
      },
      req.user,
    );
    if (geo.error) {
      await t.rollback();
      return res.status(400).json({ success: false, message: geo.error });
    }

    const unit_code =
      req.body.unit_code !== undefined
        ? await resolveUnit(req.body.unit_code)
        : row.unit_code;

    const provider_name =
      req.body.provider_name !== undefined
        ? String(req.body.provider_name || "").trim()
        : row.provider_name;
    if (!provider_name) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "provider_name is required" });
    }

    await row.update(
      {
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        unit_code,
        provider_name,
        survey_date: req.body.survey_date ?? row.survey_date,
        team: req.body.team !== undefined ? normalizeTeam(req.body.team) : row.team,
        ...metrics,
      },
      { transaction: t },
    );

    await ServicomSatisfactionSurveyResponse.destroy({ where: { reference_id }, transaction: t });
    await ServicomSatisfactionSurveyResponse.bulkCreate(
      lines.map((l) => ({ ...l, reference_id })),
      { transaction: t },
    );

    await t.commit();

    const full = await ServicomSatisfactionSurvey.findByPk(reference_id, { include: surveyInclude() });
    res.json({ success: true, data: serializeSurvey(full) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = {
  listSatisfactionSurveys,
  getSatisfactionSurvey,
  createSatisfactionSurvey,
  updateSatisfactionSurvey,
  SATISFACTION_QUESTIONS,
};
