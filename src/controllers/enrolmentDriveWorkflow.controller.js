const path = require("path");
const fs = require("fs/promises");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { EnrolmentDriveReport: Drive, EnrolmentReport: Enrolment, StateOffice, ZonalOffice, User } = require("../models");
const { EnrolmentDriveBatch: Batch, EnrolmentDriveProgramme: Programme, EnrolmentDriveAudience: Audience, EnrolmentDriveReview: Review, EnrolmentDriveAction: Action, EnrolmentDriveEvidence: Evidence } = require("../models/enrolment/EnrolmentDriveWorkflow");
const { canSubmitForms, canReviewMonthlyReport } = require("../utils/monthlyReportScope");
const { ENROLMENT_DRIVE_TYPES } = require("../utils/enrolmentDriveTypes");
const rules = require("../utils/enrolmentDriveWorkflow");
const { PRIVATE_DIR } = require("../middleware/enrolmentDriveUpload");
const { fail, reference, text, assertScope, scopeWhere, integer, activityValues, nextStatus, totals } = rules;
const editable = (batch) => ["draft", "returned"].includes(batch.status);
const respond = (handler) => async (req, res, next) => { try { await handler(req, res); } catch (error) { next(error); } };

async function capabilities(user) {
  const review = user.role === "admin" || (/state.*coordinator/.test(user.role) && !!user.state_code) || (!/zonal/.test(user.role) && await canReviewMonthlyReport(user.role) && !!user.state_code);
  const create = user.role === "admin" || (!review && !rules.NATIONAL.has(user.role) && !/zonal/.test(user.role) && await canSubmitForms(user.role));
  return { create, review, manage: review || rules.NATIONAL.has(user.role) || /zonal/.test(user.role) };
}

async function allowedRecord(Model, id, user, transaction) {
  const record = await Model.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!record) throw fail("Record not found", 404);
  assertScope(user, record);
  return record;
}

async function batchForDrive(id, user, transaction) {
  const drive = await Drive.findByPk(id, { transaction });
  if (!drive) throw fail("Activity not found", 404);
  assertScope(user, drive);
  if (!drive.batch_reference_id) throw fail("This is a historical activity. Attach it to its reporting batch before editing.");
  const batch = await allowedRecord(Batch, drive.batch_reference_id, user, transaction);
  if (transaction) await drive.reload({ transaction, lock: transaction.LOCK.UPDATE });
  return { drive, batch };
}

async function requireEditor(user, batch) {
  if (!(await capabilities(user)).create) throw fail("Your role cannot create or edit reports", 403);
  if (batch && !editable(batch)) throw fail("This report is locked for review or final submission", 409);
}

async function selections(drive, transaction) {
  const [programmes, audiences] = await Promise.all([
    Programme.findAll({ where: { drive_reference_id: drive.reference_id }, transaction }),
    Audience.findAll({ where: { drive_reference_id: drive.reference_id }, transaction }),
  ]);
  return { ...drive.toJSON(), programs_supported: programmes.map((row) => row.programme), target_audience: audiences.map((row) => row.audience) };
}

function historicalEvidence(drive) {
  return (drive.supporting_documents || []).map((file, index) => ({ reference_id: `legacy:${drive.reference_id}:${index}`, original_name: typeof file === "string" ? path.basename(file) : file.name || path.basename(file.path || "Evidence"), evidence_type: "Historical evidence" }));
}

async function batchData(batch, user) {
  const rows = await Drive.findAll({ where: { batch_reference_id: batch.reference_id }, order: [["activity_date", "ASC"], ["created_at", "ASC"]] });
  const ids = rows.map((row) => row.reference_id);
  const enrolments = ids.length ? await Enrolment.findAll({ where: { drive_reference_id: { [Op.in]: ids }, category: "enrolment" }, attributes: ["reference_id", "drive_reference_id", "enrolment_count", "category", "status", "reporting_year", "reporting_month"], raw: true }) : [];
  const summary = totals([batch], rows, enrolments);
  const activities = await Promise.all(rows.map(async (row) => ({
    ...await selections(row),
    enrolment_count: summary.counts.get(row.reference_id) || 0,
    enrolment_records: enrolments.filter((record) => record.drive_reference_id === row.reference_id),
    evidence: [...await Evidence.findAll({ where: { drive_reference_id: row.reference_id }, attributes: { exclude: ["storage_key"] }, order: [["created_at", "ASC"]] }), ...historicalEvidence(row)],
  })));
  const reviews = await Review.findAll({ where: { batch_reference_id: batch.reference_id }, order: [["created_at", "ASC"]] });
  const state = await StateOffice.findByPk(batch.state_code);
  return { ...batch.toJSON(), state_name: state?.description || batch.state_code, activities, reviews, permissions: await capabilities(user), summary: { ...summary, counts: undefined } };
}

const catalogue = respond(async (req, res) => {
  const where = scopeWhere(req.user);
  const states = await StateOffice.findAll({ where: where.state_code ? { code: where.state_code } : where.zonal_code ? { zonal_code: where.zonal_code } : {}, attributes: ["code", "description", "zonal_code"], order: [["description", "ASC"]] });
  const owners = await User.findAll({ where: { ...where, is_active: true }, attributes: ["id", "name", "state_code", "zonal_code"], order: [["name", "ASC"]] });
  const zones = await ZonalOffice.findAll({ where: { zonal_code: { [Op.in]: [...new Set(states.map((state) => state.zonal_code))] } }, attributes: ["zonal_code", "description"], order: [["description", "ASC"]] });
  res.json({ success: true, data: { programmes: rules.PROGRAMMES, audiences: rules.AUDIENCES, locations: rules.LOCATIONS, funding: rules.FUNDING, statuses: rules.STATUSES, evidence_types: rules.EVIDENCE_TYPES, drive_types: ENROLMENT_DRIVE_TYPES, states, zones, owners, permissions: await capabilities(req.user) } });
});

const listBatches = respond(async (req, res) => {
  const scope = scopeWhere(req.user);
  const where = { ...scope };
  if (req.query.state_code) { assertScope(req.user, { ...scope, state_code: req.query.state_code }); where.state_code = req.query.state_code; }
  if (req.query.year) where.reporting_year = integer(req.query.year, "Year", true);
  if (req.query.month) where.reporting_month = integer(req.query.month, "Month", true);
  const batches = await Batch.findAll({ where, order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]] });
  const ids = batches.map((batch) => batch.reference_id);
  const activities = ids.length ? await Drive.findAll({ where: { batch_reference_id: { [Op.in]: ids } }, attributes: ["reference_id", "batch_reference_id", "activity_status", "target_audience_reached", "leads_generated"], raw: true }) : [];
  res.json({ success: true, data: batches.map((batch) => ({ ...batch.toJSON(), activity_count: activities.filter((row) => row.batch_reference_id === batch.reference_id).length })) });
});

const createBatch = respond(async (req, res) => {
  await requireEditor(req.user);
  const state = await StateOffice.findByPk(req.body.state_code);
  if (!state) throw fail("Select a valid state");
  assertScope(req.user, { state_code: state.code, zonal_code: state.zonal_code });
  const year = integer(req.body.reporting_year, "Reporting year", true);
  const month = integer(req.body.reporting_month, "Reporting month", true);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) throw fail("Select a valid reporting period");
  const where = { state_code: state.code, reporting_year: year, reporting_month: month };
  const [batch] = await Batch.findOrCreate({ where, defaults: { ...where, reference_id: reference("EDB"), zonal_code: state.zonal_code, planned_activities: integer(req.body.planned_activities, "Planned activities"), reporting_officer: req.user.name || req.user.staff_id || String(req.user.id), created_by_user_id: req.user.id } });
  res.json({ success: true, data: await batchData(batch, req.user) });
});
const getBatch = respond(async (req, res) => res.json({ success: true, data: await batchData(await allowedRecord(Batch, req.params.id, req.user), req.user) }));
const updateBatch = respond(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const batch = await allowedRecord(Batch, req.params.id, req.user, transaction);
    await requireEditor(req.user, batch);
    if (Number(req.body.revision) !== batch.revision) throw fail("The batch changed. Refresh before saving.", 409);
    await batch.update({ planned_activities: integer(req.body.planned_activities, "Planned activities"), revision: batch.revision + 1 }, { transaction });
  });
  res.json({ success: true, data: await batchData(await allowedRecord(Batch, req.params.id, req.user), req.user) });
});

async function saveActivity(req, res) {
  let id;
  await sequelize.transaction(async (transaction) => {
    let batch;
    let drive;
    if (req.params.driveId) ({ drive, batch } = await batchForDrive(req.params.driveId, req.user, transaction));
    else batch = await allowedRecord(Batch, req.params.id, req.user, transaction);
    await requireEditor(req.user, batch);
    if (drive && Number(req.body.revision) !== drive.revision) throw fail("This activity changed. Refresh before editing.", 409);
    const type = ENROLMENT_DRIVE_TYPES.find((item) => item.key === req.body.drive_type);
    if (!type) throw fail("Select a valid drive type");
    const values = activityValues(req.body, { complete: req.body.complete === true, year: batch.reporting_year, month: batch.reporting_month });
    if (values.activity_category && !type.categories.some((category) => category.label === values.activity_category)) throw fail("Select an activity category for the chosen drive type");
    const { programs_supported, target_audience, other_programme, ...fields } = values;
    const patch = { ...fields, activity_category: values.activity_category || "", drive_type: type.key, drive_code: type.categories.find((category) => category.label === values.activity_category)?.code || null, state_code: batch.state_code, zonal_code: batch.zonal_code, reporting_year: batch.reporting_year, reporting_month: batch.reporting_month, batch_reference_id: batch.reference_id, quarter: Math.ceil(batch.reporting_month / 3), status: "draft" };
    if (drive) await drive.update({ ...patch, revision: drive.revision + 1 }, { transaction });
    else drive = await Drive.create({ ...patch, reference_id: reference(type.prefix), created_by_user_id: req.user.id }, { transaction });
    id = drive.reference_id;
    await Programme.destroy({ where: { drive_reference_id: id }, transaction });
    await Audience.destroy({ where: { drive_reference_id: id }, transaction });
    await Programme.bulkCreate(programs_supported.map((programme) => ({ drive_reference_id: id, programme })), { transaction });
    await Audience.bulkCreate(target_audience.map((audience) => ({ drive_reference_id: id, audience })), { transaction });
    await batch.update({ revision: batch.revision + 1 }, { transaction });
  });
  res.json({ success: true, data: { reference_id: id } });
}

const changeStatus = respond(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const batch = await allowedRecord(Batch, req.params.id, req.user, transaction);
    const action = req.body.action;
    const status = nextStatus(batch.status, action, { ...await capabilities(req.user), sameOfficer: Number(batch.submitted_by_user_id) === Number(req.user.id) });
    const note = text(req.body.note, 5000);
    if (["return", "endorse"].includes(action) && !note) throw fail("Enter a review comment");
    if (Number(req.body.revision) !== batch.revision) throw fail("The batch changed. Refresh before continuing.", 409);
    if (action === "send_for_review") {
      integer(batch.planned_activities, "Number of planned activities", true);
      const drives = await Drive.findAll({ where: { batch_reference_id: batch.reference_id }, transaction });
      if (!drives.length) throw fail("Add at least one activity before sending for review");
      for (const drive of drives) {
        activityValues(await selections(drive, transaction), { complete: true, year: batch.reporting_year, month: batch.reporting_month });
        if (drive.activity_status === "Completed" && !await Evidence.count({ where: { drive_reference_id: drive.reference_id }, transaction }) && !drive.supporting_documents?.length) throw fail(`Upload evidence for ${drive.reference_id}`);
      }
    }
    await Review.create({ reference_id: reference("EDR"), batch_reference_id: batch.reference_id, action, from_status: batch.status, to_status: status, note: note || null, revision: batch.revision, actor_user_id: req.user.id, actor_name: req.user.name || req.user.staff_id || String(req.user.id) }, { transaction });
    await batch.update({ status, revision: batch.revision + 1, ...(action === "send_for_review" ? { submitted_at: new Date(), submitted_by_user_id: req.user.id } : {}), ...(action === "final_submit" ? { finalised_at: new Date() } : {}) }, { transaction });
    await Drive.update({ status: status === "submitted" ? "approved" : ["awaiting_review", "endorsed"].includes(status) ? "submitted" : "draft" }, { where: { batch_reference_id: batch.reference_id }, transaction });
  });
  res.json({ success: true, data: await batchData(await allowedRecord(Batch, req.params.id, req.user), req.user) });
});

const uploadEvidence = respond(async (req, res) => {
  if (!req.files?.length) throw fail("Select an evidence file");
  try {
    await sequelize.transaction(async (transaction) => {
      let parent;
      if (req.params.driveId) {
        const { drive, batch } = await batchForDrive(req.params.driveId, req.user, transaction);
        await requireEditor(req.user, batch);
        parent = { drive_reference_id: drive.reference_id };
      } else {
        const action = await allowedRecord(Action, req.params.actionId, req.user, transaction);
        if (action.status === "Closed") throw fail("Closed actions cannot receive additional evidence");
        if (Number(action.owner_user_id) !== Number(req.user.id) && !(await capabilities(req.user)).manage) throw fail("Only the action owner or a manager may upload evidence", 403);
        parent = { action_reference_id: action.reference_id };
      }
      if (!rules.EVIDENCE_TYPES.includes(req.body.evidence_type)) throw fail("Select an evidence type");
      await Evidence.bulkCreate(req.files.map((file) => ({ reference_id: reference("EDE"), ...parent, evidence_type: req.body.evidence_type, original_name: file.originalname, storage_key: file.filename, mime_type: file.mimetype, file_size: file.size, uploaded_by_user_id: req.user.id })), { transaction });
    });
  } catch (error) {
    await Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => {})));
    throw error;
  }
  res.json({ success: true });
});

const downloadEvidence = respond(async (req, res) => {
  if (req.params.fileId.startsWith("legacy:")) {
    const [, driveId, rawIndex] = req.params.fileId.split(":");
    const drive = await allowedRecord(Drive, driveId, req.user);
    const index = integer(rawIndex, "Evidence index", true);
    const file = drive.supporting_documents?.[index];
    const storedPath = typeof file === "string" ? file : file?.path;
    if (!storedPath?.startsWith("/uploads/")) throw fail("Evidence not found", 404);
    const root = await fs.realpath(path.join(__dirname, "../../uploads"));
    const resolved = await fs.realpath(path.join(root, storedPath.slice("/uploads/".length)));
    if (!resolved.startsWith(`${root}${path.sep}`)) throw fail("Evidence not found", 404);
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    return res.download(resolved, typeof file === "string" ? path.basename(storedPath) : file.name || path.basename(storedPath));
  }
  const file = await Evidence.findByPk(req.params.fileId);
  if (!file) throw fail("Evidence not found", 404);
  if (file.drive_reference_id) {
    const drive = await Drive.findByPk(file.drive_reference_id);
    if (!drive) throw fail("Activity not found", 404);
    assertScope(req.user, drive);
  } else await allowedRecord(Action, file.action_reference_id, req.user);
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.download(path.join(PRIVATE_DIR, path.basename(file.storage_key)), file.original_name);
});

const listActions = respond(async (req, res) => {
  const rows = await Action.findAll({ where: scopeWhere(req.user), order: [["deadline", "ASC"]] });
  const permissions = await capabilities(req.user);
  const data = await Promise.all(rows.map(async (row) => ({ ...row.toJSON(), can_update: row.status !== "Closed" && (permissions.manage || Number(row.owner_user_id) === Number(req.user.id)), evidence: await Evidence.findAll({ where: { action_reference_id: row.reference_id }, attributes: { exclude: ["storage_key"] } }) })));
  res.json({ success: true, data });
});
const saveAction = respond(async (req, res) => {
  const permissions = await capabilities(req.user);
  let saved;
  await sequelize.transaction(async (transaction) => {
    let action = req.params.actionId ? await allowedRecord(Action, req.params.actionId, req.user, transaction) : null;
    if (!permissions.manage && (!action || Number(action.owner_user_id) !== Number(req.user.id))) throw fail("Only a manager or the assigned owner may update this action", 403);
    const body = req.body;
    if (action?.status === "Closed") throw fail("This action is closed", 409);
    const state = await StateOffice.findByPk(action?.state_code || body.state_code, { transaction });
    if (!state) throw fail("Select a state");
    assertScope(req.user, { state_code: state.code, zonal_code: state.zonal_code });
    const ownerId = permissions.manage ? (body.owner_user_id || action?.owner_user_id) : action?.owner_user_id;
    const owner = ownerId ? await User.findByPk(ownerId, { attributes: ["id", "name", "state_code", "zonal_code", "is_active"], transaction }) : null;
    if (ownerId && (!owner?.is_active || (owner.state_code && owner.state_code !== state.code) || (!owner.state_code && owner.zonal_code && owner.zonal_code !== state.zonal_code))) throw fail("Select an active owner for this state or zone");
    const status = body.status || "Open";
    if (!["Open", "In progress", "Closed"].includes(status)) throw fail("Select a valid action status");
    const outcome = text(body.outcome, 10000);
    if (status === "Closed" && (!outcome || !action || !await Evidence.count({ where: { action_reference_id: action.reference_id }, transaction }))) throw fail("Add the outcome and upload closure evidence before closing the action");
    const year = integer(action?.reporting_year || body.reporting_year, "Reporting year", true);
    const month = integer(action?.reporting_month || body.reporting_month, "Reporting month", true);
    const values = { issue: text(body.issue, 10000), source_dashboard: text(body.source_dashboard || "Enrolment Drives", 120), agreed_action: text(body.agreed_action, 10000), accountable_owner: text(body.accountable_owner, 150), deadline: text(body.deadline, 10) };
    if (Object.values(values).some((value) => !value)) throw fail("Enter the issue, agreed action, owner and deadline");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.deadline) || Number.isNaN(Date.parse(values.deadline)) || new Date(`${values.deadline}T00:00:00Z`).toISOString().slice(0, 10) !== values.deadline || year < 2000 || year > 2100 || month < 1 || month > 12) throw fail("Enter valid reporting dates");
    if (!permissions.manage && action && ["agreed_action", "deadline", "accountable_owner", "issue", "source_dashboard"].some((key) => values[key] !== action[key])) throw fail("Only a manager may change the assignment", 403);
    const patch = { ...values, accountable_owner: owner?.name || values.accountable_owner, owner_user_id: owner?.id || null, state_code: state.code, zonal_code: state.zonal_code, reporting_year: year, reporting_month: month, status, outcome, updated_by_user_id: req.user.id, closure_date: status === "Closed" ? new Date() : null };
    if (action) await action.update(patch, { transaction });
    else action = await Action.create({ ...patch, reference_id: reference("EDA"), created_by_user_id: req.user.id }, { transaction });
    saved = action;
  });
  res.json({ success: true, data: saved });
});

function groupCount(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "Unspecified";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function groupMetrics(activities, enrolmentsByDrive, keyFn) {
  const map = new Map();
  for (const activity of activities) {
    const key = keyFn(activity) || "Unspecified";
    const current = map.get(key) || { name: key, activities: 0, reached: 0, leads: 0, enrolled: 0 };
    current.activities += 1;
    current.reached += Number(activity.target_audience_reached || 0);
    current.leads += Number(activity.leads_generated || 0);
    current.enrolled += enrolmentsByDrive.get(activity.reference_id) || 0;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.enrolled - a.enrolled || b.activities - a.activities);
}

const analytics = respond(async (req, res) => {
  const scope = scopeWhere(req.user);
  const where = { ...scope };
  if (req.query.year) where.reporting_year = integer(req.query.year, "Reporting year", true);
  if (req.query.month) where.reporting_month = integer(req.query.month, "Reporting month", true);
  if (req.query.zonal_code && !scope.state_code) {
    if (scope.zonal_code && String(scope.zonal_code) !== String(req.query.zonal_code)) throw fail("Access denied", 403);
    where.zonal_code = String(req.query.zonal_code);
  }
  if (req.query.state_code) {
    const selectedState = await StateOffice.findByPk(String(req.query.state_code), { attributes: ["code", "zonal_code"], raw: true });
    if (!selectedState) throw fail("Select a valid state");
    // StateOffice PK is `code`; assertScope expects `state_code` on scoped rows.
    assertScope(req.user, { state_code: selectedState.code, zonal_code: selectedState.zonal_code });
    where.state_code = selectedState.code;
    where.zonal_code = selectedState.zonal_code;
  }
  const batches = await Batch.findAll({ where, raw: true });
  const ids = batches.map((row) => row.reference_id);
  const activities = ids.length ? await Drive.findAll({ where: { batch_reference_id: { [Op.in]: ids } }, raw: true }) : [];
  const driveIds = activities.map((row) => row.reference_id);
  const enrolments = driveIds.length ? await Enrolment.findAll({ where: { drive_reference_id: { [Op.in]: driveIds }, category: "enrolment" }, attributes: ["drive_reference_id", "category", "enrolment_count", "status"], raw: true }) : [];
  const summary = totals(batches, activities, enrolments);
  const enrolmentsByDrive = summary.counts;
  const stateFilter = where.state_code ? { code: where.state_code } : where.zonal_code ? { zonal_code: where.zonal_code } : scope.state_code ? { code: scope.state_code } : scope.zonal_code ? { zonal_code: scope.zonal_code } : {};
  const states = await StateOffice.findAll({ where: stateFilter, attributes: ["code", "description", "zonal_code"], raw: true });
  const zones = await ZonalOffice.findAll({
    where: { zonal_code: { [Op.in]: [...new Set(states.map((state) => state.zonal_code).filter(Boolean))] } },
    attributes: ["zonal_code", "description"],
    raw: true,
  });
  const zoneName = Object.fromEntries(zones.map((zone) => [zone.zonal_code, zone.description || zone.zonal_code]));
  const stateRows = states.map((state) => {
    const stateBatches = batches.filter((row) => row.state_code === state.code);
    const stateActivities = activities.filter((row) => row.state_code === state.code);
    const set = new Set(stateActivities.map((row) => row.reference_id));
    const metrics = totals(stateBatches, stateActivities, enrolments.filter((row) => set.has(row.drive_reference_id)));
    return {
      ...state,
      zone_name: zoneName[state.zonal_code] || state.zonal_code,
      ...metrics,
      counts: undefined,
      reports: stateBatches.length,
      finalised: stateBatches.filter((row) => row.status === "submitted").length,
      conversion_rate: metrics.leads ? Math.round((metrics.enrolled / metrics.leads) * 1000) / 10 : null,
      lead_rate: metrics.reached ? Math.round((metrics.leads / metrics.reached) * 1000) / 10 : null,
      pending_activities: stateActivities.filter((row) => ["Not Conducted", "Deferred", "Cancelled"].includes(row.activity_status)).length,
      late_reports: stateBatches.filter((row) => row.reporting_deadline && (row.finalised_at ? new Date(row.finalised_at).toISOString().slice(0, 10) > row.reporting_deadline : new Date().toISOString().slice(0, 10) > row.reporting_deadline)).length,
    };
  });
  const zoneRows = zones.map((zone) => {
    const zoneStates = stateRows.filter((row) => row.zonal_code === zone.zonal_code);
    const reached = zoneStates.reduce((sum, row) => sum + Number(row.reached || 0), 0);
    const leads = zoneStates.reduce((sum, row) => sum + Number(row.leads || 0), 0);
    const enrolled = zoneStates.reduce((sum, row) => sum + Number(row.enrolled || 0), 0);
    const conducted = zoneStates.reduce((sum, row) => sum + Number(row.conducted || 0), 0);
    const recorded = zoneStates.reduce((sum, row) => sum + Number(row.recorded || 0), 0);
    return {
      zonal_code: zone.zonal_code,
      description: zone.description || zone.zonal_code,
      states: zoneStates.length,
      recorded,
      conducted,
      reached,
      leads,
      enrolled,
      lead_rate: reached ? Math.round((leads / reached) * 1000) / 10 : null,
      conversion_rate: leads ? Math.round((enrolled / leads) * 1000) / 10 : null,
      offices_reporting: zoneStates.filter((row) => row.finalised > 0).length,
    };
  }).sort((a, b) => b.enrolled - a.enrolled);

  const programmeRows = driveIds.length
    ? await Programme.findAll({ where: { drive_reference_id: { [Op.in]: driveIds } }, attributes: ["drive_reference_id", "programme"], raw: true })
    : [];
  const audienceRows = driveIds.length
    ? await Audience.findAll({ where: { drive_reference_id: { [Op.in]: driveIds } }, attributes: ["drive_reference_id", "audience"], raw: true })
    : [];
  const byActivity = groupMetrics(activities, enrolmentsByDrive, (row) => row.activity_category || row.drive_type);
  const byLocation = groupMetrics(activities, enrolmentsByDrive, (row) => row.location_category);
  const locationTotal = byLocation.reduce((sum, row) => sum + row.activities, 0) || 1;
  const byAudience = groupCount(audienceRows, (row) => row.audience);
  const byProgramme = groupCount(programmeRows, (row) => row.programme).map((row) => ({
    ...row,
    enrolled: programmeRows
      .filter((item) => item.programme === row.name)
      .reduce((sum, item) => sum + (enrolmentsByDrive.get(item.drive_reference_id) || 0), 0),
  })).sort((a, b) => b.enrolled - a.enrolled || b.count - a.count);
  const programmeEnrolledTotal = byProgramme.reduce((sum, row) => sum + row.enrolled, 0) || 1;
  const programmes = byProgramme.map((row) => ({
    ...row,
    pct: Math.round((row.enrolled / programmeEnrolledTotal) * 1000) / 10,
  }));

  const officesReporting = stateRows.filter((row) => row.finalised > 0).length;

  // Prior-period enrolments by state (for declining-enrolment signal when a month is selected)
  const priorEnrolledByState = new Map();
  if (where.reporting_year && where.reporting_month) {
    const priorMonth = where.reporting_month === 1 ? 12 : where.reporting_month - 1;
    const priorYear = where.reporting_month === 1 ? where.reporting_year - 1 : where.reporting_year;
    const priorWhere = { ...scope, category: "enrolment", drive_reference_id: { [Op.ne]: null }, reporting_year: priorYear, reporting_month: priorMonth };
    if (where.zonal_code) priorWhere.zonal_code = where.zonal_code;
    if (where.state_code) priorWhere.state_code = where.state_code;
    const priorRows = await Enrolment.findAll({
      where: priorWhere,
      attributes: ["state_code", [sequelize.fn("SUM", sequelize.col("enrolment_count")), "enrolled"]],
      group: ["state_code"],
      raw: true,
    });
    for (const row of priorRows) priorEnrolledByState.set(row.state_code, Number(row.enrolled || 0));
  }

  const exceptions = stateRows
    .map((row) => {
      const issues = [];
      const plannedGap = Math.max(0, Number(row.planned || 0) - Number(row.conducted || 0));
      if (!row.reports) issues.push("No report for selected period");
      else if (row.finalised === 0) issues.push("Report not yet submitted");
      if (row.late_reports > 0) issues.push(`${row.late_reports} late report(s)`);
      if (row.pending_activities > 0) issues.push(`${row.pending_activities} deferred/cancelled activities`);
      if (plannedGap > 0) issues.push(`${plannedGap} planned activities not completed`);
      if (row.leads > 0 && (row.conversion_rate ?? 100) < 40) issues.push(`High leads, low enrolment (${row.conversion_rate}% conversion)`);
      const prior = priorEnrolledByState.get(row.code);
      if (prior != null && prior > 0 && Number(row.enrolled || 0) < prior) {
        issues.push(`Enrolment declining vs prior period (${Number(row.enrolled || 0)} vs ${prior})`);
      }
      if (!issues.length) return null;
      return {
        state_code: row.code,
        office: row.description || row.code,
        zone: row.zone_name,
        issue: issues.join("; "),
        pending_activities: row.pending_activities,
        late_reports: row.late_reports,
        planned_gap: plannedGap,
        conversion_rate: row.conversion_rate,
        enrolled: row.enrolled,
        leads: row.leads,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.late_reports + b.pending_activities + (b.planned_gap || 0)) - (a.late_reports + a.pending_activities + (a.planned_gap || 0)));

  const actionWhere = { ...scope };
  if (where.zonal_code) actionWhere.zonal_code = where.zonal_code;
  if (where.state_code) actionWhere.state_code = where.state_code;
  if (req.query.year) actionWhere.reporting_year = where.reporting_year;
  if (req.query.month) actionWhere.reporting_month = where.reporting_month;
  const followUps = await Action.findAll({
    where: actionWhere,
    order: [["deadline", "ASC"]],
    limit: 50,
    raw: true,
  });

  const historyWhere = { ...scope, category: "enrolment", drive_reference_id: { [Op.ne]: null } };
  if (where.zonal_code) historyWhere.zonal_code = where.zonal_code;
  if (where.state_code) historyWhere.state_code = where.state_code;
  const history = await Enrolment.findAll({
    where: historyWhere,
    attributes: ["reporting_year", "reporting_month", [sequelize.fn("SUM", sequelize.col("enrolment_count")), "enrolled"]],
    group: ["reporting_year", "reporting_month"],
    order: [["reporting_year", "ASC"], ["reporting_month", "ASC"]],
    raw: true,
  });

  res.json({
    success: true,
    data: {
      summary: {
        ...summary,
        counts: undefined,
        offices_total: stateRows.length,
        offices_reporting: officesReporting,
        offices_needing_follow_up: exceptions.length,
        conversion_rate: summary.leads ? Math.round((summary.enrolled / summary.leads) * 1000) / 10 : null,
        lead_rate: summary.reached ? Math.round((summary.leads / summary.reached) * 1000) / 10 : null,
      },
      states: stateRows,
      zones: zoneRows,
      by_activity: byActivity,
      by_location: byLocation.map((row) => ({
        ...row,
        percentage: Math.round((row.activities / locationTotal) * 1000) / 10,
      })),
      by_audience: byAudience,
      programmes,
      exceptions,
      follow_ups: followUps,
      enrolment_trend: history,
      definitions: {
        enrolled: "Sum of saved linked enrolment counts, including drafts; renewals remain distinguishable in Enrolment reports",
        conducted: "Activity status is Completed",
        planned: "One plan per state and reporting month",
        conversion: "Enrolment count divided by leads; no target or performance colour is implied",
        attribution: "Activity cohort totals retain their originating drive; the enrolment trend uses the enrolment reporting month",
      },
    },
  });
});

const setDeadline = respond(async (req, res) => {
  if (!(await capabilities(req.user)).manage) throw fail("Only a manager may set a reporting deadline", 403);
  const deadline = text(req.body.reporting_deadline, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(deadline)) || new Date(`${deadline}T00:00:00Z`).toISOString().slice(0, 10) !== deadline) throw fail("Enter a valid reporting deadline");
  await sequelize.transaction(async (transaction) => {
    const batch = await allowedRecord(Batch, req.params.id, req.user, transaction);
    if (Number(req.body.revision) !== batch.revision) throw fail("The batch changed. Refresh before continuing.", 409);
    await Review.create({ reference_id: reference("EDR"), batch_reference_id: batch.reference_id, action: "set_deadline", from_status: batch.status, to_status: batch.status, revision: batch.revision, note: `Reporting deadline: ${deadline}`, actor_user_id: req.user.id, actor_name: req.user.name || req.user.staff_id || String(req.user.id) }, { transaction });
    await batch.update({ reporting_deadline: deadline, revision: batch.revision + 1 }, { transaction });
  });
  res.json({ success: true, data: await batchData(await allowedRecord(Batch, req.params.id, req.user), req.user) });
});

const legacy = respond(async (req, res) => {
  const rows = await Drive.findAll({ where: { ...scopeWhere(req.user), batch_reference_id: null }, order: [["reporting_year", "DESC"], ["reporting_month", "DESC"]] });
  res.json({ success: true, data: rows.map((row) => ({ ...row.toJSON(), evidence: historicalEvidence(row) })) });
});
const attachLegacy = respond(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const batch = await allowedRecord(Batch, req.params.id, req.user, transaction);
    await requireEditor(req.user, batch);
    const drive = await allowedRecord(Drive, req.params.driveId, req.user, transaction);
    if (drive.batch_reference_id || drive.state_code !== batch.state_code || drive.reporting_year !== batch.reporting_year || drive.reporting_month !== batch.reporting_month) throw fail("Only unattached activities from the same state and reporting period can be attached");
    await drive.update({ batch_reference_id: batch.reference_id }, { transaction });
    await Programme.bulkCreate((drive.programs_supported || []).filter((value) => rules.PROGRAMMES.includes(value)).map((programme) => ({ drive_reference_id: drive.reference_id, programme })), { transaction });
    await Audience.bulkCreate((drive.target_audience || []).filter((value) => rules.AUDIENCES.includes(value)).map((audience) => ({ drive_reference_id: drive.reference_id, audience })), { transaction });
    await batch.update({ revision: batch.revision + 1 }, { transaction });
  });
  res.json({ success: true });
});

module.exports = { catalogue, listBatches, createBatch, getBatch, updateBatch, createActivity: respond(saveActivity), updateActivity: respond(saveActivity), changeStatus, uploadEvidence, downloadEvidence, listActions, saveAction, analytics, setDeadline, legacy, attachLegacy, batchForDrive, requireEditor };
