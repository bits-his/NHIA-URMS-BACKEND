/**
 * SERVICOM dashboards for approved rebuild packs only:
 * comment-card, satisfaction-survey, complaints.
 */
const { Op } = require("sequelize");
const {
  ServicomCommentCard,
  ServicomCommentCardResponse,
  ServicomSatisfactionSurvey,
  ServicomSatisfactionSurveyResponse,
  ServicomComplaint,
  StateOffice,
  ZonalOffice,
} = require("../models");
const { findActiveRole } = require("../utils/roleService");
const { ROLE_SCOPE_FALLBACK } = require("../utils/stateOfficeScope");
const { matchesPeriod, buildServicomQuality, buildComplaintRegister } = require("../utils/unitDashboards");
const { applyComplaintExtraFilters } = require("../utils/servicomScope");
const { loadComplaintSlaRules } = require("../utils/complaintSla");
const { APPROVED_FORMS } = require("../config/activeSchema");

const NATIONAL_ROLES = new Set(["admin", "sdo", "hq-department", "dg-ceo"]);

async function resolveScope(user) {
  const roleKey = user?.role;
  if (!roleKey) return "none";
  if (NATIONAL_ROLES.has(roleKey) || roleKey === "admin" || roleKey === "sdo") return "national";
  const roleDef = await findActiveRole(roleKey);
  if (roleDef?.report_scope && roleDef.report_scope !== "none") return roleDef.report_scope;
  return ROLE_SCOPE_FALLBACK[roleKey] || "none";
}

/** Query may send zone_id/state_id as legacy aliases for zonal_code/state_code. */
function geoFromQuery(query = {}) {
  const zonal_code = query.zonal_code || query.zone_id || null;
  const state_code = query.state_code || query.state_id || null;
  return {
    zonal_code: zonal_code && String(zonal_code) !== "all" ? String(zonal_code) : null,
    state_code: state_code && String(state_code) !== "all" ? String(state_code) : null,
  };
}

async function buildGeoWhere(user, query = {}) {
  const where = {};
  const location = String(query.location || "").trim().toLowerCase();

  // Location = HQ → records filed against HQ / HQ-flagged state offices
  if (location === "hq") {
    const hqStates = await StateOffice.findAll({
      where: {
        [Op.or]: [
          { is_hq: true },
          { is_zonal_office: true },
          { description: { [Op.like]: "%HQ%" } },
          { code: { [Op.like]: "HQ%" } },
        ],
      },
      attributes: ["code"],
    });
    const codes = hqStates.map((s) => s.code).filter(Boolean);
    where.state_code = codes.length ? { [Op.in]: codes } : "__hq_none__";
    return where;
  }

  const { zonal_code: qZone, state_code: qState } = geoFromQuery(query);
  if (qState) where.state_code = qState;
  if (qZone) where.zonal_code = qZone;

  const scope = await resolveScope(user);
  const userZone = user?.zonal_code ?? null;
  const userState = user?.state_code ?? null;

  if (scope === "national" || scope === "none") return where;

  if (scope === "state") {
    where.state_code = userState || "__none__";
    delete where.zonal_code;
    return where;
  }

  if (scope === "zonal") {
    where.zonal_code = userZone || "__none__";
    return where;
  }

  return where;
}

function mapCardResponses(row) {
  const plain = row.toJSON ? row.toJSON() : { ...row };
  const lines = plain.responses || [];
  plain.responses = lines.map((r) => ({
    question_id: r.question_id,
    response: r.response_value ?? r.response ?? r.score,
    score: r.score ?? r.response_value,
  }));
  return plain;
}

function mapSurveyResponses(row) {
  const plain = row.toJSON ? row.toJSON() : { ...row };
  const lines = plain.responses || [];
  plain.responses = lines.map((r) => ({
    question_id: r.question_id,
    response: r.response_value ?? r.response,
    score: r.score,
  }));
  return plain;
}

function isComplaintClosed(c) {
  const status = String(c.status || "").toLowerCase();
  return status === "closed" || status === "resolved" || status === "complaint withdrawn"
    || !!c.date_closed || !!c.resolution_date;
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
    under_investigation: "Under Investigation",
  };
  return map[key] || String(raw || "Unknown").trim() || "Unknown";
}

function emptyStateBucket(stateCode) {
  return {
    state_code: stateCode,
    surveys: 0,
    comment_cards: 0,
    complaints: 0,
    complaintsClosed: 0,
    surveyScoreSum: 0,
    surveyCount: 0,
    cardScoreSum: 0,
    cardCount: 0,
  };
}

function computeStatePerformanceScore(bucket) {
  const parts = [];
  if (bucket.surveyCount > 0) {
    parts.push({ value: bucket.surveyScoreSum / bucket.surveyCount, weight: 0.6 });
  }
  if (bucket.cardCount > 0) {
    // average_score is typically 1–5 → scale to ~100
    parts.push({ value: (bucket.cardScoreSum / bucket.cardCount) * 20, weight: 0.3 });
  }
  if (bucket.complaints > 0) {
    parts.push({
      value: (bucket.complaintsClosed / bucket.complaints) * 100,
      weight: 0.1,
    });
  }
  if (!parts.length) return null;
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  const score = parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weightSum;
  return Math.round(score * 10) / 10;
}

function buildStateRankings(surveys, cards, complaints, stateNameByCode) {
  const stateMap = {};
  for (const s of surveys) {
    if (!s.state_code) continue;
    if (!stateMap[s.state_code]) stateMap[s.state_code] = emptyStateBucket(s.state_code);
    stateMap[s.state_code].surveys += 1;
    if (s.percentage_score != null && !Number.isNaN(Number(s.percentage_score))) {
      stateMap[s.state_code].surveyScoreSum += Number(s.percentage_score);
      stateMap[s.state_code].surveyCount += 1;
    }
  }
  for (const c of cards) {
    if (!c.state_code) continue;
    if (!stateMap[c.state_code]) stateMap[c.state_code] = emptyStateBucket(c.state_code);
    stateMap[c.state_code].comment_cards += 1;
    if (c.average_score != null && !Number.isNaN(Number(c.average_score))) {
      stateMap[c.state_code].cardScoreSum += Number(c.average_score);
      stateMap[c.state_code].cardCount += 1;
    }
  }
  for (const c of complaints) {
    if (!c.state_code) continue;
    if (!stateMap[c.state_code]) stateMap[c.state_code] = emptyStateBucket(c.state_code);
    stateMap[c.state_code].complaints += 1;
    if (isComplaintClosed(c)) stateMap[c.state_code].complaintsClosed += 1;
  }

  return Object.values(stateMap)
    .map((bucket) => ({
      state_id: bucket.state_code,
      state_code: bucket.state_code,
      state_name: stateNameByCode[bucket.state_code] ?? null,
      surveys: bucket.surveys,
      comment_cards: bucket.comment_cards,
      complaints: bucket.complaints,
      avg_score: computeStatePerformanceScore(bucket),
    }))
    .filter((s) => s.avg_score != null && (s.surveys > 0 || s.comment_cards > 0))
    .sort((a, b) => b.avg_score - a.avg_score);
}

function splitTopLow(ranked) {
  const withScores = ranked.filter((s) => s.avg_score != null);
  if (!withScores.length) return { top_states: [], low_states: [] };
  if (withScores.length === 1) return { top_states: [withScores[0]], low_states: [] };
  const splitAt = Math.ceil(withScores.length / 2);
  const top_states = withScores.slice(0, Math.min(5, splitAt));
  const low_states = [...withScores.slice(splitAt)]
    .sort((a, b) => a.avg_score - b.avg_score)
    .slice(0, 5);
  return { top_states, low_states };
}

const dashboard = async (req, res, next) => {
  try {
    const geoWhere = await buildGeoWhere(req.user, req.query);
    const complaintWhere = applyComplaintExtraFilters({ ...geoWhere }, req.query);

    const loadCards = APPROVED_FORMS["comment-card"] && ServicomCommentCard
      ? ServicomCommentCard.findAll({
          where: geoWhere,
          include: [{ model: ServicomCommentCardResponse, as: "responses", required: false }],
        })
      : Promise.resolve([]);
    const loadSurveys = APPROVED_FORMS["satisfaction-survey"] && ServicomSatisfactionSurvey
      ? ServicomSatisfactionSurvey.findAll({
          where: geoWhere,
          include: [{ model: ServicomSatisfactionSurveyResponse, as: "responses", required: false }],
        })
      : Promise.resolve([]);
    const loadComplaintsDetailed = APPROVED_FORMS.complaints && ServicomComplaint
      ? ServicomComplaint.findAll({
          where: complaintWhere,
          include: [
            { model: StateOffice, as: "state", attributes: ["code", "description"] },
            { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
          ],
        })
      : Promise.resolve([]);

    const [cardRows, surveyRows, complaintRows] = await Promise.all([
      loadCards, loadSurveys, loadComplaintsDetailed,
    ]);

    const commentCardsAll = cardRows.map(mapCardResponses);
    const satisfactionSurveysAll = surveyRows.map(mapSurveyResponses);
    const complaintsAll = complaintRows;

    const period = {
      year: req.query.year,
      quarter: req.query.quarter,
      month: req.query.month,
    };
    const provider = String(req.query.provider || "").trim().toLowerCase();

    const commentCards = commentCardsAll.filter((card) => matchesPeriod(card.card_date, period));
    const satisfactionSurveys = satisfactionSurveysAll.filter((survey) => {
      if (!matchesPeriod(survey.survey_date, { ...period, date: req.query.survey_date })) return false;
      if (provider && !String(survey.provider_name || "").toLowerCase().includes(provider)) return false;
      return true;
    });
    const complaints = complaintsAll.filter((c) => matchesPeriod(
      c.date_received || c.complaint_date,
      period,
    ));

    const surveyPctScores = satisfactionSurveys
      .map((s) => Number(s.percentage_score))
      .filter((n) => !Number.isNaN(n));
    const commentAvgScores = commentCards
      .map((c) => Number(c.average_score))
      .filter((n) => !Number.isNaN(n));

    const avg_satisfaction = surveyPctScores.length
      ? Math.round((surveyPctScores.reduce((a, b) => a + b, 0) / surveyPctScores.length) * 10) / 10
      : null;
    const avg_comment_card_score = commentAvgScores.length
      ? Math.round((commentAvgScores.reduce((a, b) => a + b, 0) / commentAvgScores.length) * 100) / 100
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
    ).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

    const complaint_by_category = Object.entries(
      complaints.reduce((acc, c) => {
        const k = (c.complaint_category || "Uncategorised")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (ch) => ch.toUpperCase());
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    ).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);

    const complaint_by_domain = Object.entries(
      complaints.reduce((acc, c) => {
        const k = c.complaint_domain || c.domain_code || "Not specified";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    ).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count);

    const complaint_by_priority = Object.entries(
      complaints.reduce((acc, c) => {
        const k = c.priority_rating || "Unrated";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    ).map(([priority, count]) => ({ priority, count })).sort((a, b) => b.count - a.count);

    const stateCodes = [...new Set([
      ...satisfactionSurveys.map((s) => s.state_code),
      ...commentCards.map((c) => c.state_code),
      ...complaints.map((c) => c.state_code),
    ].filter(Boolean))];

    const stateRows = stateCodes.length
      ? await StateOffice.findAll({ where: { code: { [Op.in]: stateCodes } }, attributes: ["code", "description"] })
      : [];
    const stateNameByCode = Object.fromEntries(stateRows.map((st) => [st.code, st.description]));

    const state_satisfaction_rankings = buildStateRankings(
      satisfactionSurveys, commentCards, complaints, stateNameByCode,
    );
    const { top_states, low_states } = splitTopLow(state_satisfaction_rankings);

    const quality = buildServicomQuality(commentCards, satisfactionSurveys);
    const rules = await loadComplaintSlaRules();
    const complaints_register = buildComplaintRegister(complaints, rules);

    // Corrective-action signals: low-performing states + repeated-low satisfaction indicators
    const repeated_low_indicators = (quality?.satisfaction?.indicators || [])
      .filter((i) => i.repeated_low)
      .map((i) => ({ id: i.id, category: i.category, question: i.question, positive_rate: i.positive_rate }));

    res.json({
      success: true,
      data: {
        meta: {
          source: "database",
          tables: {
            comment_cards: "servicom_comment_cards",
            comment_card_responses: "servicom_comment_card_responses",
            satisfaction_surveys: "servicom_satisfaction_surveys",
            satisfaction_survey_responses: "servicom_satisfaction_survey_responses",
            complaints: "servicom_complaints",
          },
          counts: {
            comment_cards: commentCards.length,
            satisfaction_surveys: satisfactionSurveys.length,
            complaints: complaints_received,
          },
          period: {
            year: period.year || null,
            quarter: period.quarter || null,
            month: period.month || null,
          },
        },
        packs: {
          comment_card: !!APPROVED_FORMS["comment-card"],
          satisfaction_survey: !!APPROVED_FORMS["satisfaction-survey"],
          complaints: !!APPROVED_FORMS.complaints,
          stock_verification: false,
        },
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
        repeated_low_indicators,
        quality,
        complaints_register,
      },
    });
  } catch (err) {
    next(err);
  }
};

const complaintsDashboard = async (req, res, next) => {
  try {
    if (!APPROVED_FORMS.complaints || !ServicomComplaint) {
      return res.status(503).json({
        success: false,
        message: "Complaints is disabled during database rebuild. Approve the form design first, then it will be re-enabled.",
      });
    }

    const geoWhere = await buildGeoWhere(req.user, req.query);
    const where = applyComplaintExtraFilters({ ...geoWhere }, req.query);
    const setIf = (field, value) => {
      if (value && value !== "all") where[field] = value;
    };
    setIf("priority_rating", req.query.priority);
    setIf("complaint_category", req.query.category);
    setIf("complaint_type", req.query.type);
    setIf("transmission_route", req.query.route);
    setIf("status", req.query.status);
    setIf("complaint_domain", req.query.domain);

    const rows = await ServicomComplaint.findAll({
      where,
      include: [
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
      ],
    });
    const filtered = rows.filter((row) => matchesPeriod(row.date_received || row.complaint_date, {
      year: req.query.year,
      quarter: req.query.quarter,
      month: req.query.month,
      from: req.query.from,
      to: req.query.to,
      date: req.query.date,
    }));
    const rules = await loadComplaintSlaRules();
    const register = buildComplaintRegister(filtered, rules);
    res.json({
      success: true,
      data: {
        ...register,
        meta: {
          source: "database",
          table: "servicom_complaints",
          count: filtered.length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

const GEO_INCLUDE = [
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
];

function periodFromQuery(query = {}) {
  return {
    year: query.year,
    quarter: query.quarter,
    month: query.month,
    from: query.from,
    to: query.to,
    date: query.date || query.survey_date,
  };
}

function mapDrillRow(row, fields) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: fields.id(plain),
    reference: fields.reference?.(plain) ?? null,
    title: fields.title(plain),
    subtitle: fields.subtitle?.(plain) ?? null,
    status: fields.status?.(plain) ?? null,
    date: fields.date?.(plain) ?? null,
    state_name: plain.state?.description ?? null,
    zone_name: plain.zone?.description ?? null,
    state_id: plain.state_code ?? plain.state?.code ?? null,
    zone_id: plain.zonal_code ?? plain.zone?.zonal_code ?? null,
    meta: fields.meta?.(plain) ?? null,
  };
}

function applyComplaintDrillFilters(where, query = {}) {
  applyComplaintExtraFilters(where, query);
  const setIf = (field, value) => {
    if (value && value !== "all") where[field] = value;
  };
  setIf("priority_rating", query.priority);
  setIf("complaint_category", query.category);
  setIf("complaint_type", query.type);
  setIf("transmission_route", query.route);
  setIf("status", query.status);
  setIf("complaint_domain", query.domain);
  if (query.state_code || (query.state_id && !/^\d+$/.test(String(query.state_id)))) {
    where.state_code = query.state_code || query.state_id;
  }
  if (query.zonal_code || (query.zone_id && !/^\d+$/.test(String(query.zone_id)))) {
    where.zonal_code = query.zonal_code || query.zone_id;
  }
  return where;
}

function filterComplaintsByKpi(rows, query = {}) {
  const kpi = String(query.kpi || "").toLowerCase();
  if (!kpi) return rows;
  if (kpi === "pending") return rows.filter((c) => !isComplaintClosed(c));
  if (kpi === "closed") return rows.filter((c) => isComplaintClosed(c));
  if (kpi === "within_sla") return rows.filter((c) => c.resolution_within_sla === true || c.resolution_within_sla === 1);
  if (kpi === "beyond_sla") {
    return rows.filter((c) => isComplaintClosed(c) && (c.resolution_within_sla === false || c.resolution_within_sla === 0));
  }
  if (kpi === "overdue") return rows.filter((c) => !isComplaintClosed(c));
  if (kpi === "repeat") {
    const keys = new Map();
    for (const c of rows) {
      const who = String(c.complainant_nhis_id || c.complainant_name || "").trim().toLowerCase();
      const what = String(c.complaint_category || "").trim().toLowerCase();
      if (!who) continue;
      const key = `${who}|${what}`;
      keys.set(key, (keys.get(key) || 0) + 1);
    }
    return rows.filter((c) => {
      const who = String(c.complainant_nhis_id || c.complainant_name || "").trim().toLowerCase();
      const what = String(c.complaint_category || "").trim().toLowerCase();
      if (!who) return false;
      return (keys.get(`${who}|${what}`) || 0) > 1;
    });
  }
  return rows;
}

async function countSegment(user, query, segment) {
  const geoWhere = await buildGeoWhere(user, query);
  const period = periodFromQuery(query);

  if (segment === "comment_cards" || segment === "cards") {
    if (!APPROVED_FORMS["comment-card"] || !ServicomCommentCard) return 0;
    const rows = await ServicomCommentCard.findAll({ where: geoWhere, attributes: ["card_date"] });
    return rows.filter((r) => matchesPeriod(r.card_date, period)).length;
  }

  if (segment === "surveys" || segment === "satisfaction") {
    if (!APPROVED_FORMS["satisfaction-survey"] || !ServicomSatisfactionSurvey) return 0;
    const where = { ...geoWhere };
    if (query.provider) {
      where.provider_name = { [Op.like]: `%${String(query.provider).trim()}%` };
    }
    const rows = await ServicomSatisfactionSurvey.findAll({
      where,
      attributes: ["survey_date", "provider_name"],
    });
    return rows.filter((r) => matchesPeriod(r.survey_date, period)).length;
  }

  if (!APPROVED_FORMS.complaints || !ServicomComplaint) return 0;
  const where = applyComplaintDrillFilters({ ...geoWhere }, query);
  const rows = await ServicomComplaint.findAll({ where });
  const filtered = filterComplaintsByKpi(
    rows.filter((r) => matchesPeriod(r.date_received || r.complaint_date, period)),
    query,
  );
  return filtered.length;
}

const dashboardDrill = async (req, res, next) => {
  try {
    const segment = String(req.query.segment || "complaints");
    const recordSegment = String(req.query.record_segment || segment || "complaints");
    const period = periodFromQuery(req.query);

    if (segment === "zone_breakdown") {
      const zones = await ZonalOffice.findAll({
        attributes: ["zonal_code", "description"],
        order: [["description", "ASC"]],
      });
      const data = [];
      for (const zone of zones) {
        const count = await countSegment(
          req.user,
          { ...req.query, zone_id: zone.zonal_code, zonal_code: zone.zonal_code },
          recordSegment,
        );
        if (count > 0) {
          data.push({
            id: zone.zonal_code,
            reference: zone.zonal_code,
            title: zone.description,
            subtitle: "Zonal office",
            status: String(count),
            date: null,
            zone_name: zone.description,
            zone_id: zone.zonal_code,
            state_name: null,
            meta: `zone:${zone.zonal_code}`,
          });
        }
      }
      return res.json({ success: true, data });
    }

    if (segment === "state_breakdown") {
      const zoneCode = req.query.zonal_code || req.query.zone_id;
      if (!zoneCode) {
        return res.status(422).json({ success: false, message: "zone_id (zonal_code) required" });
      }
      const zone = await ZonalOffice.findByPk(zoneCode, { attributes: ["zonal_code", "description"] });
      const states = await StateOffice.findAll({
        where: { zonal_code: zoneCode },
        attributes: ["code", "description"],
        order: [["description", "ASC"]],
      });
      const data = [];
      for (const st of states) {
        const count = await countSegment(
          req.user,
          {
            ...req.query,
            zone_id: zoneCode,
            zonal_code: zoneCode,
            state_id: st.code,
            state_code: st.code,
          },
          recordSegment,
        );
        if (count > 0) {
          data.push({
            id: st.code,
            reference: st.code,
            title: st.description,
            subtitle: zone?.description ? `In ${zone.description}` : "State office",
            status: String(count),
            date: null,
            zone_name: zone?.description ?? null,
            zone_id: zoneCode,
            state_name: st.description,
            state_id: st.code,
            meta: `state:${st.code}`,
          });
        }
      }
      return res.json({ success: true, data });
    }

    const geoWhere = await buildGeoWhere(req.user, req.query);

    if (segment === "comment_cards" || segment === "cards") {
      if (!APPROVED_FORMS["comment-card"] || !ServicomCommentCard) {
        return res.json({ success: true, data: [] });
      }
      const rows = await ServicomCommentCard.findAll({
        where: geoWhere,
        include: GEO_INCLUDE,
        order: [["card_date", "DESC"]],
        limit: 500,
      });
      const data = rows
        .filter((r) => matchesPeriod(r.card_date, period))
        .slice(0, 200)
        .map((r) => mapDrillRow(r, {
          id: (x) => x.reference_id,
          reference: (x) => x.reference_id,
          title: (x) => x.respondent_name || x.organisation || "Citizens' Comment Card",
          subtitle: (x) => x.organisation,
          status: (x) => (x.average_score != null ? `Avg ${x.average_score}` : null),
          date: (x) => x.card_date,
        }));
      return res.json({ success: true, data });
    }

    if (segment === "surveys" || segment === "satisfaction") {
      if (!APPROVED_FORMS["satisfaction-survey"] || !ServicomSatisfactionSurvey) {
        return res.json({ success: true, data: [] });
      }
      const where = { ...geoWhere };
      if (req.query.provider) {
        where.provider_name = { [Op.like]: `%${String(req.query.provider).trim()}%` };
      }
      const rows = await ServicomSatisfactionSurvey.findAll({
        where,
        include: GEO_INCLUDE,
        order: [["survey_date", "DESC"]],
        limit: 500,
      });
      const data = rows
        .filter((r) => matchesPeriod(r.survey_date, period))
        .slice(0, 200)
        .map((r) => mapDrillRow(r, {
          id: (x) => x.reference_id,
          reference: (x) => x.reference_id,
          title: (x) => x.provider_name || "Satisfaction Survey",
          subtitle: (x) => (Array.isArray(x.team) ? x.team.filter(Boolean).join(", ") : null),
          status: (x) => (x.percentage_score != null ? `${x.percentage_score}%` : null),
          date: (x) => x.survey_date,
        }));
      return res.json({ success: true, data });
    }

    // Default / complaints (+ KPI variants)
    if (!APPROVED_FORMS.complaints || !ServicomComplaint) {
      return res.json({ success: true, data: [] });
    }
    const where = applyComplaintDrillFilters({ ...geoWhere }, req.query);
    const rows = await ServicomComplaint.findAll({
      where,
      include: GEO_INCLUDE,
      order: [["date_received", "DESC"], ["complaint_date", "DESC"]],
      limit: 800,
    });
    const filtered = filterComplaintsByKpi(
      rows.filter((r) => matchesPeriod(r.date_received || r.complaint_date, period)),
      req.query,
    ).slice(0, 200);

    res.json({
      success: true,
      data: filtered.map((r) => mapDrillRow(r, {
        id: (x) => x.complaint_number,
        reference: (x) => x.complaint_number,
        title: (x) => x.complainant_name || x.respondent_hcf_name || x.complaint_category || "Complaint",
        subtitle: (x) => [x.complaint_category, x.complaint_domain].filter(Boolean).join(" · ") || null,
        status: (x) => x.status,
        date: (x) => x.date_received || x.complaint_date,
        meta: (x) => x.priority_rating || null,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { dashboard, complaintsDashboard, dashboardDrill };
