/**
 * Enrolment Drives pack — single table, PK reference_id, filtered by drive_type.
 * FE posts lines[]; each line becomes its own row. Responses synthesize lines[].
 */
const { Op } = require("sequelize");
const {
  EnrolmentDriveReport,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { ENROLMENT_DRIVE_TYPES } = require("../utils/enrolmentDriveTypes");

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

function optNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strArray(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { /* */ }
    return [v];
  }
  return [];
}

function docsArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((d) => d && typeof d === "object" && d.path)
    .map((d) => ({ name: d.name || "Document", path: d.path }));
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function prefixFor(driveType) {
  return ENROLMENT_DRIVE_TYPES.find((t) => t.key === driveType)?.prefix || "EDRV";
}

async function nextReferenceId(driveType) {
  const year = new Date().getFullYear();
  const prefix = prefixFor(driveType);
  const fullPrefix = `${prefix}-${year}-`;
  const last = await EnrolmentDriveReport.findOne({
    where: { reference_id: { [Op.like]: `${fullPrefix}%` } },
    order: [["reference_id", "DESC"]],
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(fullPrefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${fullPrefix}${String(next).padStart(5, "0")}`;
}

function activityFromLine(line = {}) {
  return {
    drive_code: line.drive_code || null,
    activity_date: line.activity_date || null,
    activity_category: line.activity_category,
    specific_activity: line.specific_activity || null,
    funding_option: line.funding_option || null,
    activity_budget: optNum(line.activity_budget),
    approved_amount: optNum(line.approved_amount),
    target_audience: strArray(line.target_audience),
    location_category: line.location_category || null,
    location_name: line.location_name || null,
    programs_supported: strArray(line.programs_supported),
    activity_details: line.activity_details || null,
    planned_target_audience: optNum(line.planned_target_audience),
    target_audience_reached: optNum(line.target_audience_reached),
    leads_generated: optNum(line.leads_generated),
    new_enrolments: optNum(line.new_enrolments),
    supporting_documents: docsArray(line.supporting_documents),
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
  };
}

function syntheticLine(p) {
  return {
    id: p.reference_id,
    report_id: p.reference_id,
    drive_code: p.drive_code,
    activity_date: p.activity_date,
    activity_category: p.activity_category,
    specific_activity: p.specific_activity,
    funding_option: p.funding_option,
    activity_budget: p.activity_budget,
    approved_amount: p.approved_amount,
    target_audience: p.target_audience || [],
    location_category: p.location_category,
    location_name: p.location_name,
    programs_supported: p.programs_supported || [],
    activity_details: p.activity_details,
    planned_target_audience: p.planned_target_audience,
    target_audience_reached: p.target_audience_reached,
    leads_generated: p.leads_generated,
    new_enrolments: p.new_enrolments,
    supporting_documents: p.supporting_documents || [],
    activity_status: p.activity_status,
    remarks: p.remarks,
  };
}

function mapReport(row, extraLines) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const lines = Array.isArray(extraLines) && extraLines.length
    ? extraLines.map((r) => syntheticLine(r.toJSON ? r.toJSON() : r))
    : [syntheticLine(p)];
  return {
    ...p,
    id: p.reference_id,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    zone: p.zone
      ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
      : undefined,
    state: p.state
      ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
      : undefined,
    lines,
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
];

async function findReport(referenceId) {
  return EnrolmentDriveReport.findByPk(referenceId, { include: reportIncludes });
}

function makeDriveController(driveType) {
  const listReports = async (req, res, next) => {
    try {
      const where = { drive_type: driveType };
      const zonal = req.query.zonal_code || req.query.zone_id;
      const state = req.query.state_code || req.query.state_id;
      if (zonal) where.zonal_code = zonal;
      if (state) where.state_code = state;
      if (req.query.year || req.query.reporting_year) {
        where.reporting_year = Number(req.query.year || req.query.reporting_year);
      }
      if (req.query.month || req.query.reporting_month) {
        where.reporting_month = Number(req.query.month || req.query.reporting_month);
      }
      if (req.query.status) where.status = req.query.status;

      if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
        where.zonal_code = req.user.zonal_code;
      }
      if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
        where.state_code = req.user.state_code;
      }

      const rows = await EnrolmentDriveReport.findAll({
        where,
        include: reportIncludes,
        order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["reference_id", "DESC"]],
      });
      res.json({ success: true, data: rows.map((r) => mapReport(r)) });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const row = await findReport(req.params.id);
      if (!row || row.drive_type !== driveType) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }
      res.json({ success: true, data: mapReport(row) });
    } catch (err) { next(err); }
  };

  const createReport = async (req, res, next) => {
    try {
      const body = req.body || {};
      const geo = geoFromBody(req.user, body);
      if (!geo.zonal_code || !geo.state_code) {
        return res.status(422).json({ success: false, message: "Zone and state are required" });
      }
      const reporting_year = Number(body.reporting_year);
      const reporting_month = Number(body.reporting_month);
      if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
        return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
      }

      const status = body.status || "draft";
      if (status === "approved") {
        return res.status(422).json({
          success: false,
          message: "Send the report for review. Final approval follows the state coordinator's endorsement.",
        });
      }

      const rawLines = Array.isArray(body.lines) && body.lines.length
        ? body.lines
        : [body];
      const lines = rawLines.filter((l) => l && l.activity_category);
      if (!lines.length) {
        return res.status(422).json({ success: false, message: "At least one activity with a category is required" });
      }

      const quarter = quarterFromMonth(reporting_month);
      const planned = optNum(body.planned_activities) ?? lines.length;
      const created = [];
      for (const line of lines) {
        const reference_id = await nextReferenceId(driveType);
        const row = await EnrolmentDriveReport.create({
          reference_id,
          drive_type: driveType,
          ...geo,
          reporting_year,
          reporting_month,
          submission_date: body.submission_date || null,
          submitted_by: body.submitted_by || req.user?.name || null,
          status,
          planned_activities: planned,
          ...activityFromLine(line),
          quarter,
          created_by_user_id: req.user?.id || null,
        });
        created.push(row);
      }

      const full = await findReport(created[0].reference_id);
      res.status(201).json({ success: true, data: mapReport(full, created) });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    try {
      const report = await EnrolmentDriveReport.findByPk(req.params.id);
      if (!report || report.drive_type !== driveType) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }

      const body = req.body || {};
      const geo = geoFromBody(req.user, body);
      const reporting_year = body.reporting_year != null
        ? Number(body.reporting_year) : report.reporting_year;
      const reporting_month = body.reporting_month != null
        ? Number(body.reporting_month) : report.reporting_month;

      const rawLines = Array.isArray(body.lines) ? body.lines : null;
      let activityPatch = {};
      if (rawLines && rawLines.length) {
        const match = rawLines.find((l) =>
          String(l.id || l.reference_id || "") === String(report.reference_id)
        ) || rawLines[0];
        if (!match?.activity_category) {
          return res.status(422).json({ success: false, message: "Activity category is required" });
        }
        activityPatch = activityFromLine(match);

        // Persist additional new lines as separate rows
        for (const line of rawLines) {
          const lineId = String(line.id || line.reference_id || "");
          if (lineId && lineId === String(report.reference_id)) continue;
          if (lineId) {
            const existing = await EnrolmentDriveReport.findByPk(lineId);
            if (existing && existing.drive_type === driveType) {
              await existing.update({
                ...activityFromLine(line),
                reporting_year,
                reporting_month,
                quarter: quarterFromMonth(reporting_month),
                status: body.status || existing.status,
              });
              continue;
            }
          }
          if (!line.activity_category) continue;
          const reference_id = await nextReferenceId(driveType);
          await EnrolmentDriveReport.create({
            reference_id,
            drive_type: driveType,
            zonal_code: geo.zonal_code || report.zonal_code,
            state_code: geo.state_code || report.state_code,
            department_code: geo.department_code ?? report.department_code,
            unit_code: geo.unit_code ?? report.unit_code,
            reporting_year,
            reporting_month,
            submission_date: body.submission_date !== undefined
              ? body.submission_date : report.submission_date,
            submitted_by: body.submitted_by !== undefined
              ? body.submitted_by : report.submitted_by,
            status: body.status || report.status,
            planned_activities: optNum(body.planned_activities) ?? report.planned_activities,
            ...activityFromLine(line),
            quarter: quarterFromMonth(reporting_month),
            created_by_user_id: req.user?.id || null,
          });
        }
      }

      await report.update({
        zonal_code: geo.zonal_code || report.zonal_code,
        state_code: geo.state_code || report.state_code,
        department_code: geo.department_code ?? report.department_code,
        unit_code: geo.unit_code ?? report.unit_code,
        reporting_year,
        reporting_month,
        submission_date: body.submission_date !== undefined
          ? body.submission_date : report.submission_date,
        submitted_by: body.submitted_by !== undefined
          ? body.submitted_by : report.submitted_by,
        status: body.status || report.status,
        planned_activities: body.planned_activities !== undefined
          ? optNum(body.planned_activities) : report.planned_activities,
        quarter: quarterFromMonth(reporting_month),
        ...activityPatch,
      });

      const full = await findReport(report.reference_id);
      res.json({ success: true, data: mapReport(full) });
    } catch (err) { next(err); }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await EnrolmentDriveReport.findByPk(req.params.id);
      if (!report || report.drive_type !== driveType) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }
      const { status, review_note, action } = req.body || {};
      if (!status) {
        return res.status(422).json({ success: false, message: "status is required" });
      }
      const patch = { status };
      if (action === "endorse" || status === "approved") {
        patch.coordinator_reviewed_by = req.user?.name || req.user?.staff_id || null;
        patch.coordinator_reviewed_at = new Date();
        if (review_note) patch.coordinator_review_note = review_note;
      } else if (review_note) {
        patch.coordinator_review_note = review_note;
      }
      await report.update(patch);
      const full = await findReport(report.reference_id);
      res.json({ success: true, data: mapReport(full) });
    } catch (err) { next(err); }
  };

  /** Append files into supporting_documents. :lineId may equal reference_id. */
  const uploadLineFiles = async (req, res, next) => {
    try {
      const targetId = req.params.lineId || req.params.id;
      const report = await EnrolmentDriveReport.findByPk(targetId);
      if (!report || report.drive_type !== driveType) {
        // Fall back to parent report id when lineId is synthetic
        const parent = await EnrolmentDriveReport.findByPk(req.params.id);
        if (!parent || parent.drive_type !== driveType) {
          return res.status(404).json({ success: false, message: "Report not found" });
        }
        const files = req.files || [];
        if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
        const added = files.map((f) => ({
          name: f.originalname,
          path: `/uploads/beneficiary/${f.filename}`,
        }));
        await parent.update({
          supporting_documents: [...(parent.supporting_documents || []), ...added],
        });
        return res.json({ success: true, data: mapReport(await findReport(parent.reference_id)).lines[0] });
      }
      const files = req.files || [];
      if (!files.length) return res.status(422).json({ success: false, message: "No file uploaded" });
      const added = files.map((f) => ({
        name: f.originalname,
        path: `/uploads/beneficiary/${f.filename}`,
      }));
      await report.update({
        supporting_documents: [...(report.supporting_documents || []), ...added],
      });
      res.json({ success: true, data: mapReport(await findReport(report.reference_id)).lines[0] });
    } catch (err) { next(err); }
  };

  return {
    listReports,
    getReport,
    createReport,
    updateReport,
    updateStatus,
    uploadLineFiles,
  };
}

const controllersBySegment = Object.fromEntries(
  ENROLMENT_DRIVE_TYPES.map((t) => [t.segment, makeDriveController(t.key)]),
);

module.exports = {
  makeDriveController,
  controllersBySegment,
  ENROLMENT_DRIVE_TYPES,
};
