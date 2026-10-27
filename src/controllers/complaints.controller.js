const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  ServicomComplaint,
  ServicomComplaintComment,
  StateOffice,
  ZonalOffice,
  Unit,
  HmoProvider,
  User,
  Department,
} = require("../models");
const { nextComplaintNumber, previewComplaintNumber, monthYearParts } = require("../utils/complaintNumber");
const {
  computeComplaintMetrics,
  enrichComplaintCodes,
  buildAssigneeWhere,
  buildCreatedOrAssignedWhere,
  buildDepartmentEscalationWhere,
  buildZonalEscalationWhere,
  isZonalCoordinatorRole,
  isComplaintOfficerRole,
  canAccessZonalOfficeInbox,
  isZonalOfficeEscalation,
  isNationalComplaintAdmin,
  userIsAssignedInvestigator,
} = require("../utils/complaintRegister");
const { applyComplaintExtraFilters } = require("../utils/servicomScope");
const {
  loadComplaintSlaRules,
  listComplaintSlaRulesFormatted,
  enrichComplaintWithSla,
} = require("../utils/complaintSla");
const {
  isEnforcementEscalationTarget,
  isZonalCoordinatorEscalationTarget,
  isRoleEscalationInbox,
  ENFORCEMENT_TARGET,
  ZONAL_COORDINATOR_TARGET,
  notifyOfficerLabel,
  notifyEscalationTarget,
} = require("../utils/notify");
const { canSubmitForms } = require("../utils/monthlyReportScope");

const DEFAULT_UNIT = "SVC-CMP";

const WRITABLE = [
  "reporting_month", "reporting_year", "entry_date",
  "complaint_type", "complaint_against", "complaint_category", "category_code",
  "complaint_domain", "domain_code", "offence_reference",
  "priority_rating", "date_received", "transmission_route",
  "complainant_category", "complainant_id", "complainant_name", "complainant_organization",
  "complainant_phone", "complainant_nhis_id",
  "complainant_hmo_code", "complainant_hcf_code", "complainant_hcf_name",
  "respondent_category", "respondent_id", "respondent_name", "respondent_organization",
  "respondent_phone", "respondent_nhis_id",
  "respondent_hmo_code", "respondent_hcf_code", "respondent_hcf_name",
  "officer_assigned", "investigation_start_date", "status", "actions_taken", "actions_details",
  "escalated", "escalation_level", "escalation_date", "escalated_to",
  "date_closed", "outcome", "remarks", "description",
];

function complaintPk(req) {
  return decodeURIComponent(String(req.params.id || "").trim());
}

function pickFields(body) {
  const out = {};
  for (const k of WRITABLE) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.actions_taken !== undefined) {
    out.actions_taken = normalizeActionsTaken(out.actions_taken);
  }
  // Accept legacy integer-ish field names when FE still sends codes via them
  if (body.complainant_hmo_code == null && body.complainant_hmo_id != null && !/^\d+$/.test(String(body.complainant_hmo_id))) {
    out.complainant_hmo_code = body.complainant_hmo_id;
  }
  if (body.respondent_hmo_code == null && body.respondent_hmo_id != null && !/^\d+$/.test(String(body.respondent_hmo_id))) {
    out.respondent_hmo_code = body.respondent_hmo_id;
  }
  if (body.complainant_hcf_code == null && body.complainant_hcf_id != null && !/^\d+$/.test(String(body.complainant_hcf_id))) {
    out.complainant_hcf_code = body.complainant_hcf_id;
  }
  if (body.respondent_hcf_code == null && body.respondent_hcf_id != null && !/^\d+$/.test(String(body.respondent_hcf_id))) {
    out.respondent_hcf_code = body.respondent_hcf_id;
  }
  if (body.complainant_hcf_name == null && body.facility_name) {
    out.complainant_hcf_name = body.facility_name;
  }
  return out;
}

function stripLegacyMetrics(metrics) {
  const {
    assigned_officer: _a,
    resolution_date: _r,
    ...rest
  } = metrics || {};
  return rest;
}

function complaintInclude() {
  return [
    { association: "zone", attributes: ["zonal_code", "description"] },
    { association: "state", attributes: ["code", "description", "zonal_code"] },
    { association: "unit", attributes: ["unit_code", "name"], required: false },
    {
      association: "created_by_user",
      attributes: ["id", "name", "staff_id"],
      required: false,
    },
    {
      association: "complainant_hmo",
      attributes: ["hmo_code", "name"],
      required: false,
    },
    {
      association: "respondent_hmo",
      attributes: ["hmo_code", "name"],
      required: false,
    },
  ];
}

/** Coerce actions_taken to a real array (handles double-encoded JSON strings). */
function normalizeActionsTaken(raw) {
  let v = raw;
  for (let i = 0; i < 3; i += 1) {
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return [];
      try { v = JSON.parse(s); } catch { return []; }
      continue;
    }
    break;
  }
  if (Array.isArray(v)) return v;
  return [];
}

function serializeComplaint(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  data.actions_taken = normalizeActionsTaken(data.actions_taken);
  // FE helpers that still read legacy mirrors
  data.assigned_officer = data.officer_assigned;
  data.resolution_date = data.date_closed;
  data.created_by = data.created_by_user?.name || null;
  data.created_by_staff_id = data.created_by_user?.staff_id || null;
  return data;
}

function serializeComment(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  data.created_by = data.created_by_user?.name || null;
  data.created_by_staff_id = data.created_by_user?.staff_id || null;
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

async function assertHmoCode(code) {
  if (!code) return null;
  const row = await HmoProvider.findOne({ where: { hmo_code: code } });
  return row ? row.hmo_code : null;
}

function assertZonalOfficeAccess(req, row, { write = false } = {}) {
  if (isNationalComplaintAdmin(req.user)) return null;
  if (req.user?.state_code && row.state_code && req.user.state_code !== row.state_code) {
    return { status: 403, message: "Outside your state scope" };
  }
  if (req.user?.zonal_code && !req.user?.state_code && row.zonal_code && req.user.zonal_code !== row.zonal_code) {
    if (write && !canAccessZonalOfficeInbox(req.user) && !isZonalOfficeEscalation(row)) {
      return { status: 403, message: "Outside your zone scope" };
    }
    if (!write && req.user.zonal_code !== row.zonal_code) {
      return { status: 403, message: "Outside your zone scope" };
    }
  }
  return null;
}

const listComplaints = async (req, res, next) => {
  try {
    let where = {};
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

    if (req.query.status) where.status = req.query.status;
    if (req.query.priority || req.query.priority_rating) {
      where.priority_rating = req.query.priority || req.query.priority_rating;
    }
    if (req.query.category || req.query.complaint_category) {
      where.complaint_category = req.query.category || req.query.complaint_category;
    }

    if (req.query.assigned_to_me === "1" || req.query.assigned_to_me === "true") {
      const assignee = buildAssigneeWhere(req.user, Op);
      if (assignee) where = { ...where, ...assignee };
    }
    if (req.query.mine === "1" || req.query.mine === "true") {
      const mine = buildCreatedOrAssignedWhere(req.user, Op);
      if (mine) {
        const and = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];
        and.push(mine);
        where = { ...where, [Op.and]: and };
      }
    }

    // Complaint officers: inbox-scoped (zonal / dept escalation + assigned).
    // Zonal coordinators keep full zone visibility (already filtered by zonal_code above).
    if (
      isComplaintOfficerRole(req.user?.role)
      && !isNationalComplaintAdmin(req.user)
      && !req.user?.state_code
    ) {
      const zonalEsc = buildZonalEscalationWhere(req.user, Op);
      const deptEsc = buildDepartmentEscalationWhere(req.user, Op);
      const assignee = buildAssigneeWhere(req.user, Op);
      const visibilityParts = [];
      if (zonalEsc) visibilityParts.push(zonalEsc);
      if (deptEsc) visibilityParts.push(deptEsc);
      if (assignee) visibilityParts.push(assignee);
      if (visibilityParts.length) {
        const and = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];
        and.push({ [Op.or]: visibilityParts });
        where = { ...where, [Op.and]: and };
      }
    }

    applyComplaintExtraFilters(where, req.query);

    const [rows, rulesMap] = await Promise.all([
      ServicomComplaint.findAll({
        where,
        include: complaintInclude(),
        order: [["date_received", "DESC"], ["complaint_date", "DESC"], ["createdAt", "DESC"]],
      }),
      loadComplaintSlaRules(),
    ]);
    const data = await Promise.all(
      rows.map(async (r) => enrichComplaintWithSla(serializeComplaint(r), rulesMap)),
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getComplaint = async (req, res, next) => {
  try {
    const [row, rulesMap] = await Promise.all([
      ServicomComplaint.findByPk(complaintPk(req), { include: complaintInclude() }),
      loadComplaintSlaRules(),
    ]);
    if (!row) return res.status(404).json({ success: false, message: "Complaint not found" });
    const denied = assertZonalOfficeAccess(req, row, { write: false });
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });
    res.json({ success: true, data: await enrichComplaintWithSla(serializeComplaint(row), rulesMap) });
  } catch (err) {
    next(err);
  }
};

const listComplaintSla = async (req, res, next) => {
  try {
    const data = await listComplaintSlaRulesFormatted();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const previewNextNumber = async (req, res, next) => {
  try {
    const against = req.query.against || req.query.complaint_against || "HCF";
    const dateReceived = req.query.date_received || null;
    const stateCode = req.query.state_code || req.query.state_id || req.user?.state_code || null;
    if (!stateCode || /^\d+$/.test(String(stateCode))) {
      return res.json({
        success: true,
        data: { complaint_number: previewComplaintNumber(against, null, dateReceived) },
      });
    }
    const complaint_number = await nextComplaintNumber({
      against,
      stateCode,
      dateReceived,
      sequelizeModel: ServicomComplaint,
    });
    // Preview should not consume sequence — return pattern with current next as preview only
    // Recompute as soft preview (last+1 without lock): already computed; OK for UI hint
    res.json({ success: true, data: { complaint_number } });
  } catch (err) {
    next(err);
  }
};

const createComplaint = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const geo = await resolveGeo(req.body, req.user);
    if (geo.error) {
      await t.rollback();
      return res.status(400).json({ success: false, message: geo.error });
    }

    const dateReceived = req.body.date_received || req.body.complaint_date || null;
    const { month, year } = monthYearParts(dateReceived);
    const complaint_number = await nextComplaintNumber({
      against: req.body.complaint_type || req.body.complainant_category || req.body.complaint_against || "HCF",
      stateCode: geo.state_code,
      dateReceived,
      sequelizeModel: ServicomComplaint,
      transaction: t,
    });

    const fields = pickFields(req.body);
    fields.complainant_hmo_code = await assertHmoCode(fields.complainant_hmo_code);
    fields.respondent_hmo_code = await assertHmoCode(fields.respondent_hmo_code);

    const metrics = stripLegacyMetrics(await computeComplaintMetrics({ ...req.body, ...fields }));
    const unit_code = await resolveUnit(req.body.unit_code);

    const row = await ServicomComplaint.create(
      {
        ...fields,
        ...enrichComplaintCodes(req.body),
        ...metrics,
        complaint_number,
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        unit_code,
        reporting_month: req.body.reporting_month ?? month,
        reporting_year: req.body.reporting_year ?? year,
        escalated: !!req.body.escalated,
        created_by_user_id: req.user?.id ?? null,
      },
      { transaction: t },
    );

    await t.commit();

    if (row.officer_assigned) {
      await notifyOfficerLabel(row.officer_assigned, {
        title: "Complaint assigned to you",
        body: `${row.complaint_number} has been assigned to you for investigation.`,
        type: "alert",
        link: "/sdo/servicom/complaints",
        entity_type: "servicom_complaint",
        entity_id: null,
      }).catch(() => {});
    }

    const full = await ServicomComplaint.findByPk(row.complaint_number, { include: complaintInclude() });
    const rulesMap = await loadComplaintSlaRules(true);
    res.status(201).json({
      success: true,
      data: await enrichComplaintWithSla(serializeComplaint(full), rulesMap),
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateComplaint = async (req, res, next) => {
  try {
    const complaint_number = complaintPk(req);
    const row = await ServicomComplaint.findByPk(complaint_number);
    if (!row) return res.status(404).json({ success: false, message: "Complaint not found" });

    const denied = assertZonalOfficeAccess(req, row, { write: true });
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });

    const role = req.user?.role;
    if (
      isZonalCoordinatorRole(role)
      && !(await canSubmitForms(role))
      && !isZonalOfficeEscalation(row)
    ) {
      return res.status(403).json({
        success: false,
        message: "Zonal coordinator may only investigate complaints escalated to the Zonal Office.",
      });
    }

    if (
      userIsAssignedInvestigator(req.user, row)
      && !canAccessZonalOfficeInbox(req.user)
      && !isNationalComplaintAdmin(req.user)
      && (isZonalOfficeEscalation(row) || isEnforcementEscalationTarget(row.escalated_to))
    ) {
      return res.status(403).json({
        success: false,
        message: "This complaint has been escalated. You can view it but can no longer update it.",
      });
    }

    const prevOfficer = row.officer_assigned;
    const merged = { ...row.toJSON(), ...req.body };
    const fields = pickFields(req.body);
    if (fields.complainant_hmo_code !== undefined) {
      fields.complainant_hmo_code = await assertHmoCode(fields.complainant_hmo_code);
    }
    if (fields.respondent_hmo_code !== undefined) {
      fields.respondent_hmo_code = await assertHmoCode(fields.respondent_hmo_code);
    }
    const metrics = stripLegacyMetrics(await computeComplaintMetrics(merged));

    const becomingEscalated = req.body.escalated === true || req.body.escalated === "true" || req.body.escalated === 1
      || String(req.body.status || "").trim() === "Escalated";
    let escalationLevel = String(req.body.escalation_level || merged.escalation_level || "").trim();
    const alreadyAtEnforcement = isEnforcementEscalationTarget(row.escalated_to)
      || String(row.escalation_level || "").trim() === "Enforcement Department";
    const alreadyAtZonal = isZonalCoordinatorEscalationTarget(row.escalated_to)
      || String(row.escalation_level || "").trim() === "Zonal Office";

    if (becomingEscalated && alreadyAtEnforcement) {
      return res.status(422).json({
        success: false,
        message: "Enforcement Department cannot escalate further. Resolve or close the complaint.",
      });
    }

    if (becomingEscalated) {
      if (alreadyAtZonal) {
        escalationLevel = "Enforcement Department";
      } else if (!escalationLevel || escalationLevel === "State Coordinator" || escalationLevel.startsWith("Others")) {
        escalationLevel = "Zonal Office";
      } else if (escalationLevel === "Enforcement Department" && !alreadyAtZonal) {
        escalationLevel = "Zonal Office";
      }
    }

    let escalatedTo = req.body.escalated_to !== undefined ? req.body.escalated_to : row.escalated_to;
    if (becomingEscalated && escalationLevel === "Enforcement Department") {
      escalatedTo = ENFORCEMENT_TARGET;
    } else if (becomingEscalated && escalationLevel === "Zonal Office") {
      escalatedTo = ZONAL_COORDINATOR_TARGET;
    }

    const isInboxTarget = isRoleEscalationInbox(escalatedTo)
      || ["Enforcement Department", "Zonal Office"].includes(escalationLevel)
      || req.body.escalate_to_department === true
      || req.body.escalate_to_department === "true"
      || req.body.escalate_to_department === 1;

    if (becomingEscalated && escalatedTo && !isInboxTarget) {
      metrics.officer_assigned = escalatedTo;
    }

    let geoPatch = {};
    if (req.body.zonal_code || req.body.state_code || req.body.zone_id || req.body.state_id) {
      const geo = await resolveGeo(
        {
          zonal_code: req.body.zonal_code ?? row.zonal_code,
          state_code: req.body.state_code ?? row.state_code,
          zone_id: req.body.zone_id,
          state_id: req.body.state_id,
        },
        req.user,
      );
      if (geo.error) return res.status(400).json({ success: false, message: geo.error });
      geoPatch = { zonal_code: geo.zonal_code, state_code: geo.state_code };
    }

    const prevEscalatedTo = row.escalated_to;
    await row.update({
      ...fields,
      ...enrichComplaintCodes(merged),
      ...metrics,
      ...geoPatch,
      escalated: becomingEscalated || (req.body.escalated !== undefined ? !!req.body.escalated : row.escalated),
      ...(becomingEscalated && escalationLevel ? { escalation_level: escalationLevel } : {}),
      ...(becomingEscalated && !row.escalation_date && !req.body.escalation_date
        ? { escalation_date: new Date().toISOString().slice(0, 10) }
        : {}),
      ...(escalatedTo !== undefined ? { escalated_to: escalatedTo } : {}),
    });

    const nextEscalatedTo = row.escalated_to;
    const escalationTargetChanged = nextEscalatedTo && nextEscalatedTo !== prevEscalatedTo;
    if (becomingEscalated || escalationTargetChanged) {
      const target = nextEscalatedTo || escalatedTo;
      if (target) {
        const isInbox = isRoleEscalationInbox(target) || isInboxTarget;
        const title = isZonalCoordinatorEscalationTarget(target)
          ? "Complaint escalated to your zone"
          : isEnforcementEscalationTarget(target)
            ? "Complaint escalated to your department"
            : isInbox
              ? "Complaint escalated to your department"
              : "Complaint escalated to you";
        const body = isZonalCoordinatorEscalationTarget(target)
          ? `${row.complaint_number} was escalated to the Zonal Office. Immediate attention required.`
          : `${row.complaint_number} was escalated to ${target}${escalationLevel ? ` (${escalationLevel})` : ""}. Immediate attention required.`;
        await (isInbox
          ? notifyEscalationTarget(target, {
              title,
              body,
              type: "directive",
              link: "/sdo/servicom/complaints",
              entity_type: "servicom_complaint",
              entity_id: null,
            }, { stateId: row.state_code, zoneId: row.zonal_code })
          : notifyOfficerLabel(target, {
              title: "Complaint escalated to you",
              body: `${row.complaint_number} was escalated to you (${escalationLevel || "escalation"}). Immediate attention required.`,
              type: "directive",
              link: "/sdo/servicom/complaints",
              entity_type: "servicom_complaint",
              entity_id: null,
            })
        ).catch(() => {});
      }
    } else if (row.officer_assigned && row.officer_assigned !== prevOfficer) {
      await notifyOfficerLabel(row.officer_assigned, {
        title: "Complaint assigned to you",
        body: `${row.complaint_number} has been assigned to you.`,
        type: "alert",
        link: "/sdo/servicom/complaints",
        entity_type: "servicom_complaint",
        entity_id: null,
      }).catch(() => {});
    }

    const full = await ServicomComplaint.findByPk(complaint_number, { include: complaintInclude() });
    const rulesMap = await loadComplaintSlaRules(true);
    res.json({ success: true, data: await enrichComplaintWithSla(serializeComplaint(full), rulesMap) });
  } catch (err) {
    next(err);
  }
};

const listComplaintComments = async (req, res, next) => {
  try {
    const complaint_number = complaintPk(req);
    const complaint = await ServicomComplaint.findByPk(complaint_number, {
      attributes: [
        "complaint_number", "zonal_code", "state_code", "escalated", "escalated_to",
        "escalation_level", "officer_assigned",
      ],
    });
    if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });
    const denied = assertZonalOfficeAccess(req, complaint, { write: false });
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });

    const data = await ServicomComplaintComment.findAll({
      where: { complaint_number },
      include: [{ association: "created_by_user", attributes: ["id", "name", "staff_id"], required: false }],
      order: [["comment_seq", "ASC"]],
    });
    res.json({ success: true, data: data.map(serializeComment) });
  } catch (err) {
    next(err);
  }
};

const addComplaintComment = async (req, res, next) => {
  try {
    const body = String(req.body?.body ?? req.body?.comment ?? "").trim();
    if (!body) {
      return res.status(400).json({ success: false, message: "Comment is required" });
    }
    const complaint_number = complaintPk(req);
    const complaint = await ServicomComplaint.findByPk(complaint_number, {
      attributes: [
        "complaint_number", "zonal_code", "state_code", "escalated", "escalated_to",
        "escalation_level", "officer_assigned",
      ],
    });
    if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });
    const denied = assertZonalOfficeAccess(req, complaint, { write: true });
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });

    if (
      userIsAssignedInvestigator(req.user, complaint)
      && !canAccessZonalOfficeInbox(req.user)
      && !isNationalComplaintAdmin(req.user)
      && (isZonalOfficeEscalation(complaint) || isEnforcementEscalationTarget(complaint.escalated_to))
    ) {
      return res.status(403).json({
        success: false,
        message: "This complaint has been escalated. You can view it but can no longer comment.",
      });
    }

    const last = await ServicomComplaintComment.findOne({
      where: { complaint_number },
      order: [["comment_seq", "DESC"]],
    });
    const comment_seq = (last?.comment_seq || 0) + 1;

    const row = await ServicomComplaintComment.create({
      complaint_number,
      comment_seq,
      body,
      created_by_user_id: req.user?.id ?? null,
    });

    const full = await ServicomComplaintComment.findOne({
      where: { complaint_number, comment_seq },
      include: [{ association: "created_by_user", attributes: ["id", "name", "staff_id"], required: false }],
    });
    res.status(201).json({ success: true, data: serializeComment(full || row) });
  } catch (err) {
    next(err);
  }
};

const listInvestigatingOfficers = async (req, res, next) => {
  try {
    const escalationLevel = String(req.query.escalation_level || "").trim();
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

    const stateCode = req.query.state_code || req.query.state_id || req.user?.state_code || null;
    const zoneCode = req.query.zonal_code || req.query.zone_id || req.user?.zonal_code || null;

    const enfDepts = await Department.findAll({
      where: {
        [Op.or]: [
          { department_code: { [Op.in]: ["ENF", "AUD"] } },
          { name: { [Op.like]: "%Enforcement%" } },
        ],
      },
      attributes: ["department_code", "name"],
    });
    const enfDeptCodes = new Set(enfDepts.map((d) => d.department_code));

    const enfUnits = await Unit.findAll({
      where: {
        [Op.or]: [
          { unit_code: { [Op.like]: "ENF%" } },
          { unit_code: "AUD-COMP" },
          { name: { [Op.like]: "%Enforcement%" } },
          { name: { [Op.like]: "%compliance & enforcement%" } },
          ...(enfDeptCodes.size ? [{ department_code: { [Op.in]: [...enfDeptCodes] } }] : []),
        ],
      },
      attributes: ["unit_code", "name", "department_code"],
    });
    const enfUnitCodes = new Set(enfUnits.map((u) => u.unit_code));

    if (!assignMode) {
      if (escalationLevel === "State Internal" && stateCode && !/^\d+$/.test(String(stateCode))) {
        and.push({ state_code: stateCode });
      } else if (escalationLevel === "Zonal Office" && zoneCode && !/^\d+$/.test(String(zoneCode))) {
        and.push({ zonal_code: zoneCode });
      }
    }

    const rows = await User.findAll({
      where: { [Op.and]: and },
      attributes: [
        "id", "name", "staff_id", "role", "functionalities",
        "department_code", "unit_code", "state_code", "zonal_code",
      ],
      include: [
        { model: Department, as: "department", attributes: ["department_code", "name"], required: false },
        { model: Unit, as: "unit", attributes: ["unit_code", "name"], required: false },
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
        return Array.isArray(funcs)
          && (funcs.includes("Complaints Management") || funcs.includes("State Complaints Register"));
      });
    };

    const isEnforcementDept = (u) => {
      if (enfDeptCodes.has(u.department_code)) return true;
      if (enfUnitCodes.has(u.unit_code)) return true;
      const deptCode = String(u.department?.department_code || u.department_code || "").toUpperCase();
      const unitCode = String(u.unit?.unit_code || u.unit_code || "").toUpperCase();
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
        if (assignMode) return true;
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
        state_code: u.state_code ?? null,
        zonal_code: u.zonal_code ?? null,
        department: u.department?.name ?? null,
        department_code: u.department?.department_code ?? u.department_code ?? null,
        unit: u.unit?.name ?? null,
      }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listComplaints,
  getComplaint,
  listComplaintSla,
  previewNextNumber,
  createComplaint,
  updateComplaint,
  listComplaintComments,
  addComplaintComment,
  listInvestigatingOfficers,
};
