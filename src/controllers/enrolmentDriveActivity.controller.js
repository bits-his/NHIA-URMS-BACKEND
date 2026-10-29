const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  EnrolmentDriveActivityReport,
  EnrolmentDriveActivityReportLine,
  StateOffice,
  ZonalOffice,
} = require("../models");
const { ENROLMENT_DRIVE_TYPES } = require("../utils/enrolmentDriveTypes");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);
const STATUSES = ["draft", "submitted", "approved"];

const DRIVE_BY_KEY = Object.fromEntries(ENROLMENT_DRIVE_TYPES.map((t) => [t.key, t]));

async function genRefId(prefix, t) {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  const last = await EnrolmentDriveActivityReport.findOne({
    where: { reference_id: { [Op.like]: `${fullPrefix}%` } },
    order: [["reference_id", "DESC"]],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(fullPrefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${fullPrefix}${String(next).padStart(5, "0")}`;
}

function reportPk(req) {
  return decodeURIComponent(String(req.params.id || "").trim());
}

function parseLineNo(lineId, reference_id) {
  const raw = decodeURIComponent(String(lineId || "").trim());
  if (/^\d+$/.test(raw)) return Number(raw);
  const prefix = `${reference_id}-`;
  if (raw.startsWith(prefix)) {
    const n = Number(raw.slice(prefix.length));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

async function resolveGeo({ zonal_code, state_code, zone_id, state_id }, user) {
  let stateCode =
    state_code ||
    (state_id != null && state_id !== "" ? String(state_id) : null) ||
    user?.state_code ||
    null;
  let zoneCode =
    zonal_code ||
    (zone_id != null && zone_id !== "" ? String(zone_id) : null) ||
    user?.zonal_code ||
    null;

  if (!stateCode) return { error: "state_id / state_code is required" };

  const state = await StateOffice.findByPk(stateCode);
  if (!state) return { error: "Invalid state" };

  if (!zoneCode) zoneCode = state.zonal_code;
  if (state.zonal_code !== zoneCode) {
    return { error: "State does not belong to the selected zone" };
  }

  const zone = await ZonalOffice.findByPk(zoneCode);
  if (!zone) return { error: "Invalid zone" };

  return { state_code: state.code, zonal_code: zone.zonal_code };
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [v];
    } catch {
      return [v];
    }
  }
  return null;
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapLine(line, reference_id, line_no, quarter) {
  return {
    reference_id,
    line_no,
    drive_code: line.drive_code || null,
    activity_category: line.activity_category,
    activity_date: line.activity_date || null,
    activity_status: line.activity_status || null,
    specific_activity: line.specific_activity || null,
    funding_option: line.funding_option || null,
    activity_budget: numOrNull(line.activity_budget),
    approved_amount: numOrNull(line.approved_amount),
    target_audience: asArray(line.target_audience),
    location_category: line.location_category || null,
    location_name: line.location_name || null,
    programs_supported: asArray(line.programs_supported),
    activity_details: line.activity_details || null,
    planned_target_audience: numOrNull(line.planned_target_audience),
    target_audience_reached: numOrNull(line.target_audience_reached),
    leads_generated: numOrNull(line.leads_generated),
    new_enrolments: numOrNull(line.new_enrolments),
    remarks: line.remarks || null,
    supporting_documents: Array.isArray(line.supporting_documents)
      ? line.supporting_documents
      : null,
    quarter,
  };
}

function reportInclude() {
  return [
    { association: "zone", attributes: ["zonal_code", "description"] },
    { association: "state", attributes: ["code", "description", "zonal_code"] },
    { association: "lines" },
    {
      association: "created_by_user",
      attributes: ["id", "name", "staff_id"],
      required: false,
    },
  ];
}

function serializeReport(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  data.id = data.reference_id;
  data.zone_id = data.zonal_code;
  data.state_id = data.state_code;
  if (Array.isArray(data.lines)) {
    data.lines = data.lines
      .slice()
      .sort((a, b) => Number(a.line_no) - Number(b.line_no))
      .map((l) => ({
        ...l,
        id: `${l.reference_id}-${l.line_no}`,
        report_id: l.reference_id,
      }));
  }
  return data;
}

/** Factory: one controller pack per drive_type key */
function makeEnrolmentDriveController(driveTypeKey) {
  const meta = DRIVE_BY_KEY[driveTypeKey];
  if (!meta) throw new Error(`Unknown enrolment drive type: ${driveTypeKey}`);

  const listReports = async (req, res, next) => {
    try {
      const where = { drive_type: driveTypeKey };
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

      if (req.query.reporting_year) where.reporting_year = Number(req.query.reporting_year);
      if (req.query.reporting_month) where.reporting_month = Number(req.query.reporting_month);
      if (req.query.status) where.status = req.query.status;

      const rows = await EnrolmentDriveActivityReport.findAll({
        where,
        include: reportInclude(),
        order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["createdAt", "DESC"]],
      });
      res.json({ success: true, data: rows.map(serializeReport) });
    } catch (err) {
      next(err);
    }
  };

  const getReport = async (req, res, next) => {
    try {
      const row = await EnrolmentDriveActivityReport.findByPk(reportPk(req), {
        include: reportInclude(),
      });
      if (!row || row.drive_type !== driveTypeKey) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }
      res.json({ success: true, data: serializeReport(row) });
    } catch (err) {
      next(err);
    }
  };

  const createReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const geo = await resolveGeo(req.body, req.user);
      if (geo.error) {
        await t.rollback();
        return res.status(400).json({ success: false, message: geo.error });
      }

      const year = Number(req.body.reporting_year);
      const month = Number(req.body.reporting_month);
      if (!year || !month || month < 1 || month > 12) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Valid reporting year and month are required",
        });
      }

      const status = STATUSES.includes(req.body.status) ? req.body.status : "draft";
      const linesIn = Array.isArray(req.body.lines) ? req.body.lines : [];
      if (!linesIn.length) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "At least one activity line is required",
        });
      }
      if (linesIn.some((l) => !l.activity_category)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Each line requires an activity category",
        });
      }

      const reference_id = await genRefId(meta.prefix, t);
      const quarter = quarterFromMonth(month);
      const planned = numOrNull(req.body.planned_activities) ?? linesIn.length;

      await EnrolmentDriveActivityReport.create(
        {
          reference_id,
          zonal_code: geo.zonal_code,
          state_code: geo.state_code,
          drive_type: driveTypeKey,
          reporting_year: year,
          reporting_month: month,
          planned_activities: planned,
          submission_date: req.body.submission_date || null,
          submitted_by: req.body.submitted_by || req.user?.name || null,
          created_by_user_id: req.user?.id ?? null,
          status,
        },
        { transaction: t },
      );

      await EnrolmentDriveActivityReportLine.bulkCreate(
        linesIn.map((line, idx) => mapLine(line, reference_id, idx + 1, quarter)),
        { transaction: t },
      );

      await t.commit();

      const full = await EnrolmentDriveActivityReport.findByPk(reference_id, {
        include: reportInclude(),
      });
      res.status(201).json({ success: true, data: serializeReport(full) });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const updateReport = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const reference_id = reportPk(req);
      const row = await EnrolmentDriveActivityReport.findByPk(reference_id, { transaction: t });
      if (!row || row.drive_type !== driveTypeKey) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Report not found" });
      }

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

      const year = Number(req.body.reporting_year ?? row.reporting_year);
      const month = Number(req.body.reporting_month ?? row.reporting_month);
      if (!year || !month || month < 1 || month > 12) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Valid reporting year and month are required",
        });
      }

      const status = STATUSES.includes(req.body.status) ? req.body.status : row.status;
      const linesIn = Array.isArray(req.body.lines) ? req.body.lines : null;
      const quarter = quarterFromMonth(month);

      const planned =
        req.body.planned_activities !== undefined
          ? (numOrNull(req.body.planned_activities)
            ?? (linesIn ? linesIn.length : row.planned_activities))
          : (linesIn ? linesIn.length : row.planned_activities);

      await row.update(
        {
          zonal_code: geo.zonal_code,
          state_code: geo.state_code,
          reporting_year: year,
          reporting_month: month,
          planned_activities: planned,
          submission_date: req.body.submission_date !== undefined
            ? req.body.submission_date
            : row.submission_date,
          submitted_by: req.body.submitted_by !== undefined
            ? req.body.submitted_by
            : row.submitted_by,
          status,
        },
        { transaction: t },
      );

      if (linesIn) {
        if (!linesIn.length) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: "At least one activity line is required",
          });
        }
        if (linesIn.some((l) => !l.activity_category)) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: "Each line requires an activity category",
          });
        }
        await EnrolmentDriveActivityReportLine.destroy({
          where: { reference_id },
          transaction: t,
        });
        await EnrolmentDriveActivityReportLine.bulkCreate(
          linesIn.map((line, idx) => mapLine(line, reference_id, idx + 1, quarter)),
          { transaction: t },
        );
      }

      await t.commit();

      const full = await EnrolmentDriveActivityReport.findByPk(reference_id, {
        include: reportInclude(),
      });
      res.json({ success: true, data: serializeReport(full) });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const reference_id = reportPk(req);
      const row = await EnrolmentDriveActivityReport.findByPk(reference_id);
      if (!row || row.drive_type !== driveTypeKey) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }

      const status = req.body.status;
      if (!STATUSES.includes(status)) {
        return res.status(422).json({ success: false, message: "Invalid status" });
      }

      await row.update({
        status,
        submission_date: status === "submitted" && !row.submission_date
          ? new Date().toISOString().slice(0, 10)
          : row.submission_date,
      });

      const full = await EnrolmentDriveActivityReport.findByPk(reference_id, {
        include: reportInclude(),
      });
      res.json({ success: true, data: serializeReport(full) });
    } catch (err) {
      next(err);
    }
  };

  const uploadLineFiles = async (req, res, next) => {
    try {
      const reference_id = reportPk(req);
      const report = await EnrolmentDriveActivityReport.findByPk(reference_id);
      if (!report || report.drive_type !== driveTypeKey) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }

      const lineNo = parseLineNo(req.params.lineId, reference_id);
      if (!lineNo) {
        return res.status(400).json({ success: false, message: "Invalid line id" });
      }

      const line = await EnrolmentDriveActivityReportLine.findOne({
        where: { reference_id, line_no: lineNo },
      });
      if (!line) {
        return res.status(404).json({ success: false, message: "Line not found" });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ success: false, message: "No files uploaded" });
      }

      const existing = Array.isArray(line.supporting_documents)
        ? line.supporting_documents
        : [];
      const added = files.map((f) => ({
        name: f.originalname || f.filename,
        path: path.posix.join(
          "uploads",
          "beneficiary",
          path.basename(f.path || f.filename || ""),
        ),
      }));

      await line.update({ supporting_documents: [...existing, ...added] });

      const full = await EnrolmentDriveActivityReport.findByPk(reference_id, {
        include: reportInclude(),
      });
      res.json({ success: true, data: serializeReport(full) });
    } catch (err) {
      next(err);
    }
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

module.exports = { makeEnrolmentDriveController, ENROLMENT_DRIVE_TYPES };
