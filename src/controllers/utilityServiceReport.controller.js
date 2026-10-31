const { Op } = require("sequelize");
const {
  UtilityServiceReport,
  StateZonalOfficeProfile,
  StateOffice,
  ZonalOffice,
} = require("../models/active");
const { resolveOfficeGeo } = require("../utils/officeProfileGeo");
const { removeUtilityFile } = require("../middleware/utilityUpload");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
];

function serializeUtility(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    ...j,
    amount_claimed: j.amount_claimed != null ? Number(j.amount_claimed) : 0,
    amount_approved: j.amount_approved != null ? Number(j.amount_approved) : null,
  };
}

async function nextUtilityReferenceId(stateCode, category, year) {
  const catPrefix = category === "generator" ? "GEN" : category === "security" ? "SEC" : "CLN";
  const prefix = `UTL-${catPrefix}-${year}-${stateCode}-`;
  const last = await UtilityServiceReport.findOne({
    where: { reference_id: { [Op.like]: `${prefix}%` } },
    order: [["reference_id", "DESC"]],
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

const listReports = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.query);
    const where = {};
    if (geo.state_code) where.state_code = geo.state_code;
    else if (geo.zonal_code) where.zonal_code = geo.zonal_code;

    if (req.query.year || req.query.reporting_year) {
      where.reporting_year = Number(req.query.year || req.query.reporting_year);
    }
    if (req.query.month || req.query.reporting_month) {
      where.reporting_month = Number(req.query.month || req.query.reporting_month);
    }
    if (req.query.service_category) {
      where.service_category = req.query.service_category;
    }
    if (req.query.frequency) {
      where.frequency = req.query.frequency;
    }
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.consolidated_batch_id) {
      where.consolidated_batch_id = req.query.consolidated_batch_id;
    }
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [
        { reference_id: { [Op.like]: q } },
        { contractor_name: { [Op.like]: q } },
        { invoice_number: { [Op.like]: q } },
        { service_description: { [Op.like]: q } },
      ];
    }

    const rows = await UtilityServiceReport.findAll({
      where,
      include: includeGeo,
      order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["id", "DESC"]],
    });
    res.json({ success: true, data: rows.map(serializeUtility) });
  } catch (err) {
    next(err);
  }
};

const getReport = async (req, res, next) => {
  try {
    const isNum = /^\d+$/.test(req.params.id);
    const where = isNum ? { id: req.params.id } : { reference_id: req.params.id };
    const row = await UtilityServiceReport.findOne({ where, include: includeGeo });
    if (!row) {
      return res.status(404).json({ success: false, message: "Utility service report not found" });
    }
    res.json({ success: true, data: serializeUtility(row) });
  } catch (err) {
    next(err);
  }
};

const createReport = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.body);
    if (!geo.state_code || !geo.zonal_code) {
      return res.status(400).json({ success: false, message: "State and zone are required" });
    }
    const reporting_year = Number(req.body.reporting_year || new Date().getFullYear());
    const service_category = req.body.service_category || "generator";
    const frequency = service_category === "generator" ? "biannual" : (req.body.frequency || "monthly");
    const reporting_month = frequency === "monthly" ? Number(req.body.reporting_month || (new Date().getMonth() + 1)) : null;

    const reference_id = await nextUtilityReferenceId(geo.state_code, service_category, reporting_year);

    let profileId = req.body.profile_id ? Number(req.body.profile_id) : null;
    if (!profileId) {
      const profile = await StateZonalOfficeProfile.findOne({
        where: { state_code: geo.state_code, reporting_year },
      });
      if (profile) profileId = profile.id;
    }

    const files = req.files || {};
    const certFile = files.job_completion_cert?.[0];
    const invFile = files.invoice?.[0];
    const letterFile = files.contractor_letter?.[0];

    const row = await UtilityServiceReport.create({
      reference_id,
      profile_id: profileId,
      zonal_code: geo.zonal_code,
      state_code: geo.state_code,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year,
      reporting_month,
      service_category,
      frequency,
      cycle: req.body.cycle ? Number(req.body.cycle) : null,
      contractor_name: req.body.contractor_name || "N/A",
      contractor_phone: req.body.contractor_phone || null,
      contractor_email: req.body.contractor_email || null,
      invoice_number: req.body.invoice_number || null,
      amount_claimed: req.body.amount_claimed ? Number(req.body.amount_claimed) : 0,
      amount_approved: req.body.amount_approved ? Number(req.body.amount_approved) : null,
      service_description: req.body.service_description || null,

      job_completion_cert_path: certFile ? `/uploads/utility-services/${certFile.filename}` : null,
      job_completion_cert_name: certFile ? certFile.originalname : null,
      invoice_path: invFile ? `/uploads/utility-services/${invFile.filename}` : null,
      invoice_name: invFile ? invFile.originalname : null,
      contractor_letter_path: letterFile ? `/uploads/utility-services/${letterFile.filename}` : null,
      contractor_letter_name: letterFile ? letterFile.originalname : null,

      status: req.body.status || "draft",
      submission_date: req.body.status === "submitted" ? new Date().toISOString().slice(0, 10) : null,
      submitted_by: req.user?.name || req.user?.staff_id || null,
      created_by: req.user?.name || req.user?.staff_id || null,
      created_by_user_id: req.user?.id || null,
    });

    const full = await UtilityServiceReport.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: serializeUtility(full) });
  } catch (err) {
    next(err);
  }
};

const updateReport = async (req, res, next) => {
  try {
    const row = await UtilityServiceReport.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Utility service report not found" });
    }

    const files = req.files || {};
    const certFile = files.job_completion_cert?.[0];
    const invFile = files.invoice?.[0];
    const letterFile = files.contractor_letter?.[0];

    const updates = {
      contractor_name: req.body.contractor_name !== undefined ? req.body.contractor_name : row.contractor_name,
      contractor_phone: req.body.contractor_phone !== undefined ? req.body.contractor_phone : row.contractor_phone,
      contractor_email: req.body.contractor_email !== undefined ? req.body.contractor_email : row.contractor_email,
      invoice_number: req.body.invoice_number !== undefined ? req.body.invoice_number : row.invoice_number,
      amount_claimed: req.body.amount_claimed !== undefined ? Number(req.body.amount_claimed) : row.amount_claimed,
      amount_approved: req.body.amount_approved !== undefined ? Number(req.body.amount_approved) : row.amount_approved,
      service_description: req.body.service_description !== undefined ? req.body.service_description : row.service_description,
      cycle: req.body.cycle !== undefined ? Number(req.body.cycle) : row.cycle,
      reporting_month: req.body.reporting_month !== undefined ? Number(req.body.reporting_month) : row.reporting_month,
    };

    if (certFile) {
      removeUtilityFile(row.job_completion_cert_path);
      updates.job_completion_cert_path = `/uploads/utility-services/${certFile.filename}`;
      updates.job_completion_cert_name = certFile.originalname;
    }
    if (invFile) {
      removeUtilityFile(row.invoice_path);
      updates.invoice_path = `/uploads/utility-services/${invFile.filename}`;
      updates.invoice_name = invFile.originalname;
    }
    if (letterFile) {
      removeUtilityFile(row.contractor_letter_path);
      updates.contractor_letter_path = `/uploads/utility-services/${letterFile.filename}`;
      updates.contractor_letter_name = letterFile.originalname;
    }

    if (req.body.status) {
      updates.status = req.body.status;
      if (req.body.status === "submitted" && !row.submission_date) {
        updates.submission_date = new Date().toISOString().slice(0, 10);
        updates.submitted_by = req.user?.name || req.user?.staff_id || null;
      }
    }

    await row.update(updates);
    const full = await UtilityServiceReport.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: serializeUtility(full) });
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const row = await UtilityServiceReport.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Utility service report not found" });
    }
    const { status, coordinator_review_note } = req.body;
    const updates = { status };
    if (status === "submitted") {
      updates.submission_date = new Date().toISOString().slice(0, 10);
      updates.submitted_by = req.user?.name || req.user?.staff_id;
    } else if (status === "endorsed" || status === "approved" || status === "returned") {
      updates.coordinator_reviewed_by = req.user?.name || req.user?.staff_id;
      updates.coordinator_reviewed_at = new Date();
      if (coordinator_review_note !== undefined) {
        updates.coordinator_review_note = coordinator_review_note;
      }
    }
    await row.update(updates);
    const full = await UtilityServiceReport.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: serializeUtility(full) });
  } catch (err) {
    next(err);
  }
};

/**
 * Zonal Coordinator action: Consolidate multiple state security & cleaning monthly reports
 * under their zone into a single consolidated payment request batch to HQ.
 */
const consolidateReports = async (req, res, next) => {
  try {
    const { report_ids, zonal_code } = req.body;
    if (!Array.isArray(report_ids) || !report_ids.length) {
      return res.status(400).json({ success: false, message: "Provide report IDs to consolidate" });
    }
    const zCode = zonal_code || req.user?.zonal_code;
    const batchId = `ZONAL-BATCH-${zCode || "HQ"}-${Date.now()}`;

    await UtilityServiceReport.update(
      {
        consolidated_batch_id: batchId,
        status: "consolidated",
        coordinator_reviewed_by: req.user?.name || req.user?.staff_id,
        coordinator_reviewed_at: new Date(),
      },
      {
        where: { id: { [Op.in]: report_ids } },
      }
    );

    const consolidated = await UtilityServiceReport.findAll({
      where: { consolidated_batch_id: batchId },
      include: includeGeo,
    });
    res.json({
      success: true,
      batch_id: batchId,
      message: `Successfully consolidated ${consolidated.length} reports into batch ${batchId}`,
      data: consolidated.map(serializeUtility),
    });
  } catch (err) {
    next(err);
  }
};

const deleteReport = async (req, res, next) => {
  try {
    const row = await UtilityServiceReport.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Utility service report not found" });
    }
    removeUtilityFile(row.job_completion_cert_path);
    removeUtilityFile(row.invoice_path);
    removeUtilityFile(row.contractor_letter_path);
    await row.destroy();
    res.json({ success: true, message: "Utility service report deleted" });
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
  consolidateReports,
  deleteReport,
};

