const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  ServicomCommentCard,
  ServicomCommentCardResponse,
  StateOffice,
  ZonalOffice,
  Unit,
} = require("../models");

const DEFAULT_UNIT = "SVC-STD";

/** Mirror of frontend COMMENT_CARD_QUESTIONS */
const COMMENT_CARD_QUESTIONS = [
  { id: "Q01", section: "Reception", question: "How would you rate the quality of service received at our reception?", scale: 5 },
  { id: "Q02", section: "Front Desk Staff", question: "Front desk staff are courteous & polite", scale: 4 },
  { id: "Q03", section: "Front Desk Staff", question: "Front desk staff are professional & well-informed", scale: 4 },
  { id: "Q04", section: "Front Desk Staff", question: "Front desk staff are prompt & efficient", scale: 4 },
  { id: "Q05", section: "Overall", question: "Overall rating of the quality of service / interaction within our organisation", scale: 5 },
];

async function genRefId(t) {
  const year = new Date().getFullYear();
  const prefix = `CCC-${year}-`;
  const last = await ServicomCommentCard.findOne({
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

function cardPk(req) {
  return decodeURIComponent(String(req.params.id || "").trim());
}

function normalizeLines(rawResponses) {
  const byId = new Map();
  if (Array.isArray(rawResponses)) {
    for (const r of rawResponses) {
      if (r?.question_id) byId.set(String(r.question_id), r);
    }
  }
  const lines = [];
  for (const q of COMMENT_CARD_QUESTIONS) {
    const raw = byId.get(q.id) || {};
    const value = raw.response_value ?? raw.response ?? raw.score;
    const num = value != null && value !== "" ? Number(value) : null;
    lines.push({
      question_id: q.id,
      section: q.section,
      question_text: q.question,
      scale_max: q.scale,
      response_value: num,
      score: num,
    });
  }
  return lines;
}

function missingLines(lines) {
  return lines.filter(
    (l) =>
      l.response_value == null ||
      Number.isNaN(l.response_value) ||
      l.response_value < 1 ||
      l.response_value > l.scale_max,
  );
}

function computeMetrics(lines) {
  const scored = lines.filter((l) => l.score != null && !Number.isNaN(l.score));
  const total = scored.reduce((sum, l) => sum + Number(l.score), 0);
  const average = scored.length ? Math.round((total / scored.length) * 100) / 100 : 0;
  return { total_score: total, average_score: average };
}

function cardInclude() {
  return [
    { association: "zone", attributes: ["zonal_code", "description"] },
    { association: "state", attributes: ["code", "description", "zonal_code"] },
    { association: "unit", attributes: ["unit_code", "name"] },
    { association: "responses", attributes: { exclude: [] } },
    {
      association: "created_by_user",
      attributes: ["id", "name", "staff_id"],
      required: false,
    },
  ];
}

/** Shape response lines like legacy JSON for FE compatibility */
function serializeCard(row) {
  const data = row.toJSON ? row.toJSON() : row;
  const lines = Array.isArray(data.responses) ? data.responses : [];
  data.responses = lines
    .slice()
    .sort((a, b) => String(a.question_id).localeCompare(String(b.question_id)))
    .map((l) => ({
      question_id: l.question_id,
      section: l.section,
      question: l.question_text,
      response: l.response_value != null ? String(l.response_value) : null,
      score: l.score,
      scale_max: l.scale_max,
    }));
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

  if (!stateCode) {
    return { error: "state_code is required" };
  }

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

const listCommentCards = async (req, res, next) => {
  try {
    const where = {};
    const zoneKey = req.query.zonal_code || req.query.zone_id;
    const stateKey = req.query.state_code || req.query.state_id;

    // Scope by user's geo when present; otherwise honour query filters
    if (req.user?.state_code) {
      where.state_code = req.user.state_code;
    } else if (req.user?.zonal_code) {
      where.zonal_code = req.user.zonal_code;
      if (stateKey) where.state_code = stateKey;
    } else {
      if (zoneKey) where.zonal_code = zoneKey;
      if (stateKey) where.state_code = stateKey;
    }

    const rows = await ServicomCommentCard.findAll({
      where,
      include: cardInclude(),
      order: [["card_date", "DESC"], ["createdAt", "DESC"]],
    });
    res.json({ success: true, data: rows.map(serializeCard) });
  } catch (err) {
    next(err);
  }
};

const getCommentCard = async (req, res, next) => {
  try {
    const row = await ServicomCommentCard.findByPk(cardPk(req), { include: cardInclude() });
    if (!row) return res.status(404).json({ success: false, message: "Comment card not found" });
    res.json({ success: true, data: serializeCard(row) });
  } catch (err) {
    next(err);
  }
};

const createCommentCard = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const lines = normalizeLines(req.body.responses);
    if (missingLines(lines).length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "All questions are required with valid scores" });
    }
    const metrics = computeMetrics(lines);

    const geo = await resolveGeo(req.body, req.user);
    if (geo.error) {
      await t.rollback();
      return res.status(400).json({ success: false, message: geo.error });
    }

    // Always system-generated PK — ignore client-supplied reference_id
    const reference_id = await genRefId(t);
    const unit_code = await resolveUnit(req.body.unit_code);

    const row = await ServicomCommentCard.create(
      {
        reference_id,
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        unit_code,
        card_date: req.body.card_date,
        respondent_name: req.body.respondent_name ?? null,
        organisation: req.body.organisation ?? null,
        ...metrics,
        created_by_user_id: req.user?.id ?? null,
      },
      { transaction: t },
    );

    await ServicomCommentCardResponse.bulkCreate(
      lines.map((l) => ({ ...l, reference_id: row.reference_id })),
      { transaction: t },
    );

    await t.commit();

    const full = await ServicomCommentCard.findByPk(row.reference_id, { include: cardInclude() });
    res.status(201).json({ success: true, data: serializeCard(full) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateCommentCard = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const reference_id = cardPk(req);
    const row = await ServicomCommentCard.findByPk(reference_id, { transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Comment card not found" });
    }

    const lines = normalizeLines(req.body.responses);
    if (missingLines(lines).length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "All questions are required with valid scores" });
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

    await row.update(
      {
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        unit_code,
        card_date: req.body.card_date ?? row.card_date,
        respondent_name:
          req.body.respondent_name !== undefined ? req.body.respondent_name : row.respondent_name,
        organisation: req.body.organisation !== undefined ? req.body.organisation : row.organisation,
        ...metrics,
      },
      { transaction: t },
    );

    await ServicomCommentCardResponse.destroy({ where: { reference_id }, transaction: t });
    await ServicomCommentCardResponse.bulkCreate(
      lines.map((l) => ({ ...l, reference_id })),
      { transaction: t },
    );

    await t.commit();

    const full = await ServicomCommentCard.findByPk(reference_id, { include: cardInclude() });
    res.json({ success: true, data: serializeCard(full) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = {
  listCommentCards,
  getCommentCard,
  createCommentCard,
  updateCommentCard,
  COMMENT_CARD_QUESTIONS,
};
