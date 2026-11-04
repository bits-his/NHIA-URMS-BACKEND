const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { MeetingReport, MeetingItem, EtmcReport, EtmcEntry } = require("../models/MeetingsCoordination");
const { StateOffice, ZonalOffice, User } = require("../models");
const FormDocument = require("../models/shared/FormDocument");
const { appendDocuments } = require("../utils/formDocuments");
const { NATIONAL, fail, reference, text, scopeWhere, assertScope, integer } = require("../utils/enrolmentDriveWorkflow");
const { grantForFunctionality } = require("../middleware/stateOfficeAccess");
const { Department } = require("../models");

const MEETING_FORM_KEY = "meeting-reports";
const ETMC_FORM_KEY = "etmc-reports";

const MEETING_TYPES = [
  "Monthly Meeting", "ETMC Cascading Meeting", "Activity / Outing Planning Briefing",
  "Operational Coordination Meeting", "Performance Review Meeting",
  "Special Assignment / Ad-hoc Meeting", "Emergency / Ad-hoc Meeting",
  "Training / Capacity Building Meeting", "AOP / Budget Planning Meeting",
  "Review of Previous Decisions / Action Points", "Other (Specify)",
];
const ITEM_STATUSES = ["Pending", "In Progress", "Completed", "No longer Applicable"];
const DECISION_STATUSES = ["Pending", "In Progress", "Completed"];
const RESPOND = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") return res.status(422).json({ success: false, message: "A report for this state, month and meeting type already exists" });
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};
const dateOnly = (v, label, required = false) => {
  const s = String(v ?? "").slice(0, 10);
  if (!s) { if (required) throw fail(`${label} is required`); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw fail(`Enter a valid ${label.toLowerCase()}`);
  return s;
};
const YNP = ["Yes", "No", "Partially"];
const checkYN = (v, allowPartial = true, allowNA = false) => {
  const s = text(v, 10); if (!s) return null;
  if (![...(allowPartial ? YNP : ["Yes", "No"]), ...(allowNA ? ["N/A"] : [])].includes(s)) throw fail("Select Yes, No or Partially");
  return s;
};
const actorName = (u) => u.name || u.staff_id || String(u.id);
const ZONAL = /zonal-coordinator|^zc$|-zonal-coordinator/;
const hasAccess = (u) => NATIONAL.has(u?.role) || ["State Office Meeting Report", "ETMC Cascading Report"].some((t) => grantForFunctionality(Array.isArray(u?.functionalities) ? u.functionalities : (() => { try { return JSON.parse(u?.functionalities || "[]"); } catch { return []; } })(), t));
const canCreate = (u) => u?.role === "admin" || (hasAccess(u) && u?.role !== "dg-ceo" && !ZONAL.test(u?.role || ""));
const isZonal = (u) => ZONAL.test(u?.role || "") || u?.role_config?.report_scope === "zonal";
const canReview = (u) => hasAccess(u) && (canAssign(u) || isZonal(u) || u?.role === "soc-state-coordinator" || (u?.role || "").endsWith("-state-coordinator"));
const canAssign = (u) => NATIONAL.has(u?.role) && u?.role !== "dg-ceo";

const catalogue = RESPOND(async (req, res) => {
  const scope = scopeWhere(req.user);
  const states = await StateOffice.findAll({
    where: scope.state_code ? { code: scope.state_code } : scope.zonal_code ? { zonal_code: scope.zonal_code } : {},
    attributes: ["code", "description", "zonal_code"], order: [["description", "ASC"]],
  });
  const zones = await ZonalOffice.findAll({ where: { zonal_code: { [Op.in]: [...new Set(states.map((s) => s.zonal_code))] } }, attributes: ["zonal_code", "description"] });
  const departments = await Department.findAll({ attributes: ["department_code", "description"], order: [["description", "ASC"]] }).catch(() => []);
  const roleLabel = req.user.role_label || String(req.user.role || "").replace(/-/g, " ");
  res.json({ success: true, data: {
    meeting_types: MEETING_TYPES, item_statuses: ITEM_STATUSES, decision_statuses: DECISION_STATUSES,
    yn: YNP, venues: ["Physical", "Virtual"], etmc_sessions: ["Q1", "Q2", "Q3", "Q4"],
    departments, states, zones,
    default_state: scope.state_code || req.user.state_code || null,
    default_zone: scope.zonal_code || req.user.zonal_code || null,
    role_label: roleLabel,
    user_name: actorName(req.user),
    permissions: { user_id: req.user.id, create: canCreate(req.user), review: canReview(req.user), assign: canAssign(req.user), national: NATIONAL.has(req.user.role) },
  } });
});

async function allowed(Model, idField, id, user, transaction) {
  const row = await Model.findByPk(id, { transaction });
  if (!row) throw fail("Record not found", 404);
  assertScope(user, row);
  return row;
}
const meetingHeader = (body, user) => {
  const type = text(body.meeting_type, 100);
  if (!MEETING_TYPES.includes(type)) throw fail("Select a valid meeting type");
  if (type === "Other (Specify)" && !text(body.other_meeting_type)) throw fail("Specify the meeting type");
  const year = integer(body.reporting_year, "reporting year", true);
  const month = integer(body.reporting_month, "reporting month", true);
  if (month < 1 || month > 12) throw fail("Enter a valid reporting month");
  const strength = integer(body.staff_strength, "staff strength");
  const attendees = integer(body.attendees, "number of attendees");
  const rate = strength && attendees != null ? Math.min(999.99, Math.round((attendees / strength) * 10000) / 100) : null;
  for (const k of ["eff_prev_reviewed", "eff_issues_discussed", "eff_attendance_adequate"]) checkYN(body[k]);
  for (const k of ["eff_decisions_documented", "eff_officers_assigned", "eff_deadlines_assigned", "eff_escalations_identified"]) checkYN(body[k], false);
  return {
    reporting_year: year, reporting_month: month,
    meeting_date: dateOnly(body.meeting_date, "Meeting date", true),
    meeting_type: type, other_meeting_type: text(body.other_meeting_type, 150) || null,
    purpose: text(body.purpose, 5000) || null,
    presiding_officer: text(body.presiding_officer, 150) || null,
    venue: ["Physical", "Virtual"].includes(body.venue) ? body.venue : null,
    staff_strength: strength, attendees, attendance_rate: rate,
    eff_prev_reviewed: checkYN(body.eff_prev_reviewed),
    eff_issues_discussed: checkYN(body.eff_issues_discussed),
    eff_decisions_documented: checkYN(body.eff_decisions_documented, false),
    eff_officers_assigned: checkYN(body.eff_officers_assigned, false),
    eff_deadlines_assigned: checkYN(body.eff_deadlines_assigned, false),
    eff_escalations_identified: checkYN(body.eff_escalations_identified, false),
    eff_attendance_adequate: checkYN(body.eff_attendance_adequate),
    prepared_by: text(body.prepared_by, 150) || actorName(user),
    designation: text(body.designation, 120) || null,
    submission_date: dateOnly(body.submission_date, "submission date") || new Date().toISOString().slice(0, 10),
  };
};

function itemRows(meetingId, year, month, seedRefs = []) {
  const rows = [];
  const usedRefs = new Set(seedRefs.filter(Boolean));
  let seq = 0;
  for (const r of usedRefs) {
    const m = String(r).match(/-(\d+)$/);
    if (m) seq = Math.max(seq, Number(m[1]) || 0);
  }
  const nextRef = () => {
    let ref;
    do {
      seq += 1;
      ref = `TAR-MMR-${year}-${String(month).padStart(2, "0")}-${String(seq).padStart(3, "0")}`;
    } while (usedRefs.has(ref));
    usedRefs.add(ref);
    return ref;
  };
  const push = (kind, list) => (Array.isArray(list) ? list : []).forEach((item) => {
    const isDecision = kind === "decision";
    const row = {
      item_id: reference("MIT"), meeting_id: meetingId, item_kind: kind,
      subject: text(item.subject, 255) || null,
      detail: text(item.detail, 5000) || null,
      outcome: text(item.outcome, 5000) || null,
      requires_action: kind === "agenda" && ["Yes", "No"].includes(item.requires_action) ? item.requires_action : null,
      responsible_officer: text(item.responsible_officer, 150) || null,
      due_date: dateOnly(item.due_date, "due date"),
      expected_output: text(item.expected_output, 255) || null,
      status: item.status && ITEM_STATUSES.includes(item.status) ? item.status : (isDecision || kind === "followup" ? "Pending" : null),
      remarks: text(item.remarks, 5000) || null,
      parent_item_id: kind === "followup" && text(item.parent_item_id, 30) ? text(item.parent_item_id, 30) : null,
      action_ref: null,
    };
    if (isDecision) {
      const kept = text(item.action_ref, 40);
      row.action_ref = kept && !usedRefs.has(kept) ? (usedRefs.add(kept), kept) : nextRef();
    }
    rows.push(row);
  });
  return { push, rows };
}

const listMeetings = RESPOND(async (req, res) => {
  const where = { ...scopeWhere(req.user) };
  for (const [q, c] of [["status", "status"], ["type", "meeting_type"], ["state", "state_code"], ["year", "reporting_year"], ["month", "reporting_month"]]) if (req.query[q]) where[c] = req.query[q];
  if (req.query.mine === "1" || req.query.mine === "true") where.created_by_user_id = req.user.id;
  const rows = await MeetingReport.findAll({ where, include: [{ model: MeetingItem, as: "items", attributes: ["item_id", "item_kind", "subject", "status", "action_ref"] }], order: [["meeting_date", "DESC"], ["createdAt", "DESC"]] });
  res.json({ success: true, data: rows });
});

const saveMeeting = async (req, res, id) => {
  if (!canCreate(req.user)) throw fail("You do not have permission to submit meeting reports", 403);
  const scope = scopeWhere(req.user);
  let row;
  await sequelize.transaction(async (transaction) => {
    const state = await StateOffice.findByPk(req.body.state_code || scope.state_code, { transaction });
    if (!state) throw fail("Select a valid state");
    assertScope(req.user, { state_code: state.code, zonal_code: state.zonal_code });
    const header = meetingHeader(req.body, req.user);
    header.status = req.body.status === "submitted" ? "submitted" : "draft";
    const followups = Array.isArray(req.body.followups) ? req.body.followups : [];
    if (header.status === "submitted") {
      const openWhere = {
        item_kind: "decision",
        status: { [Op.in]: ["Pending", "In Progress"] },
        ...(id ? { meeting_id: { [Op.ne]: id } } : {}),
      };
      const open = await MeetingItem.count({
        where: openWhere,
        include: [{ model: MeetingReport, as: "meeting", where: { ...scope }, attributes: [], required: true }],
        transaction,
      });
      if (open > 0 && followups.length === 0) {
        throw fail("Record follow-up on previous meeting action points before submitting", 422);
      }
    }
    if (id) {
      row = await allowed(MeetingReport, "meeting_id", id, req.user, transaction);
      if (row.created_by_user_id !== req.user.id && !canAssign(req.user)) throw fail("You can only edit reports you created", 403);
      if (row.status === "approved") throw fail("Approved reports cannot be edited", 403);
      await row.update(header, { transaction });
      await MeetingItem.destroy({ where: { meeting_id: row.meeting_id }, transaction });
    } else {
      row = await MeetingReport.create({ ...header, meeting_id: reference("MMR"), state_code: state.code, zonal_code: state.zonal_code, created_by_user_id: req.user.id, created_by_name: actorName(req.user) }, { transaction });
    }
    const existingRefs = await MeetingItem.findAll({
      where: { item_kind: "decision", action_ref: { [Op.like]: `TAR-MMR-${header.reporting_year}-${String(header.reporting_month).padStart(2, "0")}-%` } },
      attributes: ["action_ref"],
      include: [{ model: MeetingReport, as: "meeting", where: { state_code: state.code }, attributes: [], required: true }],
      transaction,
    }).catch(() => []);
    const builder = itemRows(row.meeting_id, header.reporting_year, header.reporting_month, existingRefs.map((r) => r.action_ref));
    builder.push("agenda", req.body.agenda_items);
    builder.push("decision", req.body.decisions);
    builder.push("followup", followups);
    if (builder.rows.length) await MeetingItem.bulkCreate(builder.rows, { transaction });
    for (const f of followups) {
      const parentId = text(f.parent_item_id, 30);
      if (!parentId) continue;
      const patch = {};
      if (f.status && ITEM_STATUSES.includes(f.status)) patch.status = f.status;
      if (Object.keys(patch).length) await MeetingItem.update(patch, { where: { item_id: parentId, item_kind: "decision" }, transaction });
    }
  });
  res.status(id ? 200 : 201).json({ success: true, data: row });
};

const getMeeting = RESPOND(async (req, res) => {
  const row = await allowed(MeetingReport, "meeting_id", req.params.id, req.user);
  const [items, docs] = await Promise.all([
    MeetingItem.findAll({ where: { meeting_id: row.meeting_id }, order: [["createdAt", "ASC"]] }),
    FormDocument.findAll({ where: { form_key: MEETING_FORM_KEY, report_reference_id: row.meeting_id }, order: [["sn", "ASC"]] }),
  ]);
  res.json({ success: true, data: { ...row.toJSON(), items, documents: docs } });
});

const uploadMeetingDocuments = RESPOND(async (req, res) => {
  const row = await allowed(MeetingReport, "meeting_id", req.params.id, req.user);
  if (row.created_by_user_id !== req.user.id && !canAssign(req.user)) throw fail("You can only upload evidence to reports you created", 403);
  if (row.status === "approved") throw fail("Approved reports cannot receive new evidence", 403);
  const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
  if (!files.length) throw fail("Select at least one evidence file", 422);
  const added = files.map((f) => ({
    doc_kind: "evidence",
    name: f.originalname,
    path: `/uploads/meetings/${f.filename}`,
    mime: f.mimetype || null,
  }));
  await appendDocuments(MEETING_FORM_KEY, row.meeting_id, added);
  const documents = await FormDocument.findAll({
    where: { form_key: MEETING_FORM_KEY, report_reference_id: row.meeting_id },
    order: [["sn", "ASC"]],
  });
  res.json({ success: true, data: { meeting_id: row.meeting_id, documents } });
});

const deleteMeetingDocument = RESPOND(async (req, res) => {
  const row = await allowed(MeetingReport, "meeting_id", req.params.id, req.user);
  if (row.created_by_user_id !== req.user.id && !canAssign(req.user)) throw fail("You can only remove evidence from reports you created", 403);
  if (row.status === "approved") throw fail("Approved reports cannot be edited", 403);
  const sn = integer(req.params.sn, "document", true);
  const removed = await FormDocument.destroy({
    where: { form_key: MEETING_FORM_KEY, report_reference_id: row.meeting_id, sn },
  });
  if (!removed) throw fail("Document not found", 404);
  res.json({ success: true });
});

/** Open action points from earlier meetings — feed §4 follow-up */
const openActionPoints = RESPOND(async (req, res) => {
  const scope = scopeWhere(req.user);
  const items = await MeetingItem.findAll({
    where: { item_kind: "decision", status: { [Op.in]: ["Pending", "In Progress"] } },
    include: [{ model: MeetingReport, as: "meeting", where: { ...scope }, attributes: ["meeting_id", "meeting_date", "meeting_type", "reporting_year", "reporting_month"], required: true }],
    order: [["due_date", "ASC"]],
  });
  res.json({ success: true, data: items });
});

const transitionMeeting = RESPOND(async (req, res) => {
  const row = await allowed(MeetingReport, "meeting_id", req.params.id, req.user);
  const next = text(req.body.status, 20);
  const own = row.created_by_user_id === req.user.id;
  if (next === "submitted" && own && row.status === "draft") await row.update({ status: "submitted" });
  else if (next === "approved" && canReview(req.user) && row.status === "submitted") await row.update({ status: "approved", endorsed_by: actorName(req.user) });
  else if (next === "draft" && canReview(req.user) && row.status === "submitted") await row.update({ status: "draft", endorsed_by: null });
  else throw fail("This action is not permitted for your role or the current status", 403);
  res.json({ success: true, data: row });
});

/* ── ETMC ── */
const etmcHeader = (body, user) => {
  const year = integer(body.reporting_year, "reporting year", true);
  const month = integer(body.reporting_month, "reporting month", true);
  const strength = integer(body.staff_strength, "staff strength");
  const present = integer(body.staff_present, "staff present");
  const rate = strength && present != null ? Math.min(999.99, Math.round((present / strength) * 10000) / 100) : null;
  if (body.etmc_session && !["Q1", "Q2", "Q3", "Q4"].includes(body.etmc_session)) throw fail("Select a valid ETMC session");
  const checklist = {};
  for (const k of ["ev_attendance_list", "ev_minutes", "ev_presentation", "ev_photographs", "ev_action_tracker", "ev_escalations_documented"]) {
    const v = text(body[k], 10); if (v && !["Yes", "No", "N/A"].includes(v)) throw fail("Select Yes, No or N/A");
    checklist[k] = v || null;
  }
  return {
    reporting_year: year, reporting_month: month,
    etmc_meeting_date: dateOnly(body.etmc_meeting_date, "ETMC meeting date", true),
    cascade_session_date: dateOnly(body.cascade_session_date, "cascade session date"),
    etmc_session: body.etmc_session || null,
    presiding_officer: text(body.presiding_officer, 150) || null,
    venue: ["Physical", "Virtual"].includes(body.venue) ? body.venue : null,
    staff_strength: strength, staff_present: present, attendance_rate: rate,
    ...checklist,
    prepared_by: text(body.prepared_by, 150) || actorName(user),
    designation: text(body.designation, 120) || null,
    submission_date: dateOnly(body.submission_date, "submission date") || new Date().toISOString().slice(0, 10),
  };
};
const entryRows = (etmcId, body) => {
  const out = [];
  const kinds = { highlights: "highlight", department_updates: "department_update", resolutions: "resolution", comments: "comment", feedback: "feedback" };
  for (const [key, kind] of Object.entries(kinds)) {
    (Array.isArray(body[key]) ? body[key] : []).forEach((e) => {
      out.push({
        entry_id: reference("ETE"), etmc_id: etmcId, entry_kind: kind,
        subject: text(e.subject, 255) || null,
        detail: text(e.detail, 5000) || null,
        owner_deadline: text(e.owner_deadline, 255) || null,
      });
    });
  }
  return out;
};
const listEtmc = RESPOND(async (req, res) => {
  const where = { ...scopeWhere(req.user) };
  for (const [q, c] of [["status", "status"], ["state", "state_code"], ["year", "reporting_year"], ["month", "reporting_month"], ["session", "etmc_session"]]) if (req.query[q]) where[c] = req.query[q];
  if (req.query.mine === "1" || req.query.mine === "true") where.created_by_user_id = req.user.id;
  const rows = await EtmcReport.findAll({ where, order: [["etmc_meeting_date", "DESC"]] });
  res.json({ success: true, data: rows });
});
const saveEtmc = async (req, res, id) => {
  if (!canCreate(req.user)) throw fail("You do not have permission to submit ETMC reports", 403);
  const scope = scopeWhere(req.user);
  let row;
  await sequelize.transaction(async (transaction) => {
    const state = await StateOffice.findByPk(req.body.state_code || scope.state_code, { transaction });
    if (!state) throw fail("Select a valid state");
    assertScope(req.user, { state_code: state.code, zonal_code: state.zonal_code });
    const header = etmcHeader(req.body, req.user);
    header.status = req.body.status === "submitted" ? "submitted" : "draft";
    if (id) {
      row = await allowed(EtmcReport, "etmc_id", id, req.user, transaction);
      if (row.created_by_user_id !== req.user.id && !canAssign(req.user)) throw fail("You can only edit reports you created", 403);
      await row.update(header, { transaction });
      await EtmcEntry.destroy({ where: { etmc_id: row.etmc_id }, transaction });
    } else {
      row = await EtmcReport.create({ ...header, etmc_id: reference("ETC"), state_code: state.code, zonal_code: state.zonal_code, created_by_user_id: req.user.id, created_by_name: actorName(req.user) }, { transaction });
    }
    const entries = entryRows(row.etmc_id, req.body);
    if (entries.length) await EtmcEntry.bulkCreate(entries, { transaction });
  });
  res.status(id ? 200 : 201).json({ success: true, data: row });
};
const getEtmc = RESPOND(async (req, res) => {
  const row = await allowed(EtmcReport, "etmc_id", req.params.id, req.user);
  const [entries, docs] = await Promise.all([
    EtmcEntry.findAll({ where: { etmc_id: row.etmc_id }, order: [["createdAt", "ASC"]] }),
    FormDocument.findAll({ where: { form_key: ETMC_FORM_KEY, report_reference_id: row.etmc_id }, order: [["sn", "ASC"]] }),
  ]);
  res.json({ success: true, data: { ...row.toJSON(), entries, documents: docs } });
});
const transitionEtmc = RESPOND(async (req, res) => {
  const row = await allowed(EtmcReport, "etmc_id", req.params.id, req.user);
  const next = text(req.body.status, 20);
  const own = row.created_by_user_id === req.user.id;
  if (next === "submitted" && own && row.status === "draft") await row.update({ status: "submitted" });
  else if (next === "approved" && canReview(req.user) && row.status === "submitted") await row.update({ status: "approved", endorsed_by: actorName(req.user) });
  else if (next === "draft" && canReview(req.user) && row.status === "submitted") await row.update({ status: "draft", endorsed_by: null });
  else throw fail("This action is not permitted for your role or the current status", 403);
  res.json({ success: true, data: row });
});

module.exports = {
  hasAccess, MEETING_TYPES,
  catalogue, listMeetings, getMeeting, openActionPoints, transitionMeeting,
  uploadMeetingDocuments, deleteMeetingDocument,
  createMeeting: RESPOND((req, res) => saveMeeting(req, res, null)),
  updateMeeting: RESPOND((req, res) => saveMeeting(req, res, req.params.id)),
  listEtmc, getEtmc, transitionEtmc,
  createEtmc: RESPOND((req, res) => saveEtmc(req, res, null)),
  updateEtmc: RESPOND((req, res) => saveEtmc(req, res, req.params.id)),
};
