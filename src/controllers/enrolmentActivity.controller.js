const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  EnrolmentActivityReport,
  EnrolmentActivityReportLine,
  StateOffice,
  ZonalOffice,
} = require("../models");

const quarterFromMonth = (month) => Math.ceil(Number(month) / 3);
const STATUSES = ["draft", "submitted", "approved"];

async function genRefId(t) {
  const year = new Date().getFullYear();
  const prefix = `ENR-${year}-`;
  const last = await EnrolmentActivityReport.findOne({
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

function reportPk(req) {
  return decodeURIComponent(String(req.params.id || "").trim());
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

function mapLine(line, reference_id, line_no, quarter) {
  const details = line.program_details && typeof line.program_details === "object"
    ? line.program_details
    : (line.program_details
      ? (() => { try { return JSON.parse(line.program_details); } catch { return null; } })()
      : null);

  return {
    reference_id,
    line_no,
    category: line.category,
    activity_code: line.activity_code || null,
    activity_date: line.activity_date || null,
    enrolment_channel: line.enrolment_channel || null,
    enrolment_type: line.enrolment_type || null,
    program_code: line.program_code || null,
    program_name: line.program_name || null,
    enrolment_category: line.enrolment_category || null,
    beneficiary_category: line.beneficiary_category || null,
    beneficiary_status: line.beneficiary_status || null,
    funding_option: line.funding_option || null,
    supporting_evidence: line.supporting_evidence || null,
    status_reason: line.status_reason || null,
    activity_budget: line.activity_budget != null && line.activity_budget !== ""
      ? Number(line.activity_budget) : null,
    approved_amount: line.approved_amount != null && line.approved_amount !== ""
      ? Number(line.approved_amount) : null,
    enrolment_count: Number(line.enrolment_count) || 0,
    enrollees_validated: line.enrollees_validated != null && line.enrollees_validated !== ""
      ? Number(line.enrollees_validated) : null,
    activity_status: line.activity_status || null,
    remarks: line.remarks || null,
    program_details: details,
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

/** FE still expects zone_id / state_id / id on report payloads */
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

const listReports = async (req, res, next) => {
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

    if (req.query.reporting_year) where.reporting_year = Number(req.query.reporting_year);
    if (req.query.reporting_month) where.reporting_month = Number(req.query.reporting_month);
    if (req.query.status) where.status = req.query.status;

    const rows = await EnrolmentActivityReport.findAll({
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
    const row = await EnrolmentActivityReport.findByPk(reportPk(req), { include: reportInclude() });
    if (!row) return res.status(404).json({ success: false, message: "Report not found" });
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
      return res.status(400).json({ success: false, message: "Valid reporting year and month are required" });
    }

    const status = STATUSES.includes(req.body.status) ? req.body.status : "draft";
    const linesIn = Array.isArray(req.body.lines) ? req.body.lines : [];
    if (!linesIn.length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "At least one activity line is required" });
    }
    if (linesIn.some((l) => !l.category)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Each line requires a category" });
    }

    const reference_id = await genRefId(t);
    const quarter = quarterFromMonth(month);

    await EnrolmentActivityReport.create(
      {
        reference_id,
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        reporting_year: year,
        reporting_month: month,
        submission_date: req.body.submission_date || null,
        submitted_by: req.body.submitted_by || req.user?.name || null,
        created_by_user_id: req.user?.id ?? null,
        status,
      },
      { transaction: t },
    );

    await EnrolmentActivityReportLine.bulkCreate(
      linesIn.map((line, idx) => mapLine(line, reference_id, idx + 1, quarter)),
      { transaction: t },
    );

    await t.commit();

    const full = await EnrolmentActivityReport.findByPk(reference_id, { include: reportInclude() });
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
    const row = await EnrolmentActivityReport.findByPk(reference_id, { transaction: t });
    if (!row) {
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
      return res.status(400).json({ success: false, message: "Valid reporting year and month are required" });
    }

    const status = STATUSES.includes(req.body.status) ? req.body.status : row.status;
    const linesIn = Array.isArray(req.body.lines) ? req.body.lines : null;
    const quarter = quarterFromMonth(month);

    await row.update(
      {
        zonal_code: geo.zonal_code,
        state_code: geo.state_code,
        reporting_year: year,
        reporting_month: month,
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
        return res.status(400).json({ success: false, message: "At least one activity line is required" });
      }
      if (linesIn.some((l) => !l.category)) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Each line requires a category" });
      }
      await EnrolmentActivityReportLine.destroy({ where: { reference_id }, transaction: t });
      await EnrolmentActivityReportLine.bulkCreate(
        linesIn.map((line, idx) => mapLine(line, reference_id, idx + 1, quarter)),
        { transaction: t },
      );
    }

    await t.commit();

    const full = await EnrolmentActivityReport.findByPk(reference_id, { include: reportInclude() });
    res.json({ success: true, data: serializeReport(full) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const reference_id = reportPk(req);
    const row = await EnrolmentActivityReport.findByPk(reference_id);
    if (!row) return res.status(404).json({ success: false, message: "Report not found" });

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

    const full = await EnrolmentActivityReport.findByPk(reference_id, { include: reportInclude() });
    res.json({ success: true, data: serializeReport(full) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
  updateStatus,
};
