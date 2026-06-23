const sequelize = require("../config/database");
const { AnnualReport, QuarterlyData, StateOffice, ZonalOffice } = require("../models");

// ─── Approval chain definition ────────────────────────────────────────────────
//
//  state-officer      → submits          → status: "submitted"
//  state-coordinator  → approves/rejects → status: "under_review" | "rejected"
//  zonal-coordinator  → approves/rejects → status: "zonal_review"  | "rejected"
//  sdo                → approves/rejects → status: "approved"       | "rejected"
//
const CHAIN = {
  "state-coordinator": {
    requiredStatus: "submitted",
    approveStatus:  "under_review",
    auditApprove:   (actor) => ({ state_reviewed_by: actor, state_reviewed_at: new Date() }),
    auditReject:    (actor, reason) => ({ rejected_by: actor, rejected_at: new Date(), rejection_reason: reason }),
  },
  "zonal-coordinator": {
    requiredStatus: "under_review",
    approveStatus:  "zonal_review",
    auditApprove:   (actor) => ({ zonal_reviewed_by: actor, zonal_reviewed_at: new Date() }),
    auditReject:    (actor, reason) => ({ rejected_by: actor, rejected_at: new Date(), rejection_reason: reason }),
  },
  "sdo": {
    requiredStatus: "zonal_review",
    approveStatus:  "approved",
    auditApprove:   (actor) => ({ sdo_reviewed_by: actor, sdo_reviewed_at: new Date() }),
    auditReject:    (actor, reason) => ({ rejected_by: actor, rejected_at: new Date(), rejection_reason: reason }),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateReferenceId = async (year, transaction) => {
  const count = await AnnualReport.count({ where: { reporting_year: year }, transaction });
  return `NHIA-AR-${year}-${String(count + 1).padStart(5, "0")}`;
};

const calcSubTotal = (q) =>
  [q.q1, q.q2, q.q3, q.q4].reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

const buildQuarterlyRows = (referenceId, quarterly) =>
  Object.entries(quarterly).map(([category, quarters]) => ({
    annual_report_ref: referenceId,
    category,
    q1: parseFloat(quarters.q1) || 0,
    q2: parseFloat(quarters.q2) || 0,
    q3: parseFloat(quarters.q3) || 0,
    q4: parseFloat(quarters.q4) || 0,
    sub_total: calcSubTotal(quarters),
  }));

const findReport = (referenceId) =>
  AnnualReport.findByPk(referenceId, {
    include: [{ model: QuarterlyData, as: "quarterly_data" }],
  });

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/annual-reports
 * State officer creates/submits a report.
 */
const createReport = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { general, clinical, quarterly, status = "submitted", submitted_by } = req.body;
    const reference_id = await generateReferenceId(general.year, t);

    await AnnualReport.create({
      reference_id,
      reporting_year: general.year,
      state: general.state,
      staff_no: general.staffNo || null,
      total_vehicles: general.totalVehicles || null,
      total_hcf_under_nhia: general.totalHCF || null,
      total_accredited_hcf: general.totalAccreditedHCF2025 || null,
      approved_budget: general.approvedBudget2025 || null,
      total_amount_utilized: general.totalAmountUtilized2025 || null,
      total_accredited_cemonc: clinical.totalAccreditedCEmONC || null,
      total_cemonc_beneficiaries: clinical.totalCEmONCBeneficiaries || null,
      total_accredited_ffp: clinical.totalAccreditedFFP || null,
      total_ffp_beneficiaries: clinical.totalFFPBeneficiaries || null,
      status,
      submitted_by: submitted_by || req.user?.name || null,
    }, { transaction: t });

    if (quarterly && typeof quarterly === "object") {
      await QuarterlyData.bulkCreate(buildQuarterlyRows(reference_id, quarterly), { transaction: t });
    }

    await t.commit();
    res.status(201).json({ success: true, data: await findReport(reference_id) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * GET /api/annual-reports
 * Role-scoped listing:
 *   state-officer / state-coordinator → only their state
 *   zonal-coordinator                 → only states in their zone
 *   sdo / admin / hq-department / dg-ceo → all
 */
const listReports = async (req, res, next) => {
  try {
    const where = {};
    const role = req.user?.role;

    // Explicit query filters (override role scope if provided by admin/sdo)
    if (req.query.state)  where.state = req.query.state;
    if (req.query.year)   where.reporting_year = req.query.year;
    if (req.query.status) where.status = req.query.status;

    // Role-based scoping
    if (role === "state-officer" || role === "state-coordinator") {
      // Scope to the user's state name
      if (req.user.state_id && !req.query.state) {
        const stateOffice = await StateOffice.findByPk(req.user.state_id);
        if (stateOffice) where.state = stateOffice.description;
      }
      // State coordinator only sees submitted+ (not drafts from other officers)
      if (role === "state-coordinator" && !req.query.status) {
        where.status = ["submitted", "under_review", "zonal_review", "approved", "rejected"];
      }
    } else if (role === "zonal-coordinator") {
      // Scope to states in the user's zone
      if (req.user.zone_id && !req.query.state) {
        const zoneStates = await StateOffice.findAll({
          where: { zonal_id: req.user.zone_id },
          attributes: ["description"],
        });
        const stateNames = zoneStates.map(s => s.description);
        if (stateNames.length) where.state = stateNames;
        // Zonal coordinator only sees under_review+ (state-coordinator already approved)
        if (!req.query.status) {
          where.status = ["under_review", "zonal_review", "approved", "rejected"];
        }
      }
    } else if (role === "sdo") {
      // SDO sees zonal_review+ (ready for final approval)
      if (!req.query.status) {
        where.status = ["zonal_review", "approved", "rejected"];
      }
    }

    const reports = await AnnualReport.findAll({
      where,
      include: [{ model: QuarterlyData, as: "quarterly_data" }],
      order: [["created_at", "DESC"]],
    });

    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/annual-reports/:referenceId
 */
const getReport = async (req, res, next) => {
  try {
    const report = await findReport(req.params.referenceId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/annual-reports/:referenceId
 * Only allowed on draft/rejected reports by the original submitter.
 */
const updateReport = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const report = await AnnualReport.findByPk(req.params.referenceId, { transaction: t });
    if (!report) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Only allow edits on draft or rejected reports
    if (!["draft", "rejected"].includes(report.status)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: "Cannot edit a report that is under review or approved" });
    }

    const { general, clinical, quarterly, status } = req.body;
    await report.update({
      reporting_year: general.year,
      state: general.state,
      staff_no: general.staffNo || null,
      total_vehicles: general.totalVehicles || null,
      total_hcf_under_nhia: general.totalHCF || null,
      total_accredited_hcf: general.totalAccreditedHCF2025 || null,
      approved_budget: general.approvedBudget2025 || null,
      total_amount_utilized: general.totalAmountUtilized2025 || null,
      total_accredited_cemonc: clinical.totalAccreditedCEmONC || null,
      total_cemonc_beneficiaries: clinical.totalCEmONCBeneficiaries || null,
      total_accredited_ffp: clinical.totalAccreditedFFP || null,
      total_ffp_beneficiaries: clinical.totalFFPBeneficiaries || null,
      ...(status && { status }),
    }, { transaction: t });

    if (quarterly && typeof quarterly === "object") {
      await QuarterlyData.destroy({ where: { annual_report_ref: report.reference_id }, transaction: t });
      await QuarterlyData.bulkCreate(buildQuarterlyRows(report.reference_id, quarterly), { transaction: t });
    }

    await t.commit();
    res.json({ success: true, data: await findReport(report.reference_id) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * PATCH /api/annual-reports/:referenceId/approve
 * Role-enforced approval. Each role can only approve from the correct preceding status.
 *
 * Body: { note?: string }
 */
const approveReport = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const chain = CHAIN[role];

    if (!chain) {
      return res.status(403).json({ success: false, message: "Your role cannot approve reports" });
    }

    const report = await AnnualReport.findByPk(req.params.referenceId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    if (report.status !== chain.requiredStatus) {
      return res.status(422).json({
        success: false,
        message: `Cannot approve: report is "${report.status}", expected "${chain.requiredStatus}"`,
      });
    }

    const actor = req.user.name || req.user.staff_id;
    await report.update({
      status: chain.approveStatus,
      ...chain.auditApprove(actor),
      ...(req.body.note && { [`${role.split("-")[0]}_review_note`]: req.body.note }),
    });

    res.json({ success: true, data: report, message: `Report approved and forwarded` });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/annual-reports/:referenceId/reject
 * Role-enforced rejection. Sends report back to "rejected" with reason.
 *
 * Body: { reason: string }
 */
const rejectReport = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const chain = CHAIN[role];

    if (!chain) {
      return res.status(403).json({ success: false, message: "Your role cannot reject reports" });
    }

    const report = await AnnualReport.findByPk(req.params.referenceId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    if (report.status !== chain.requiredStatus) {
      return res.status(422).json({
        success: false,
        message: `Cannot reject: report is "${report.status}", expected "${chain.requiredStatus}"`,
      });
    }

    if (!req.body.reason) {
      return res.status(422).json({ success: false, message: "Rejection reason is required" });
    }

    const actor = req.user.name || req.user.staff_id;
    await report.update({
      status: "rejected",
      ...chain.auditReject(actor, req.body.reason),
    });

    res.json({ success: true, data: report, message: "Report rejected" });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/annual-reports/:referenceId/status
 * Generic status update — admin only.
 */
const updateStatus = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const allowed = ["draft", "submitted", "under_review", "zonal_review", "approved", "rejected"];
    if (!allowed.includes(req.body.status)) {
      return res.status(422).json({ success: false, message: "Invalid status value" });
    }
    const report = await AnnualReport.findByPk(req.params.referenceId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    await report.update({ status: req.body.status });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/annual-reports/:referenceId
 */
const deleteReport = async (req, res, next) => {
  try {
    const report = await AnnualReport.findByPk(req.params.referenceId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    await report.destroy();
    res.json({ success: true, message: `Report ${req.params.referenceId} deleted` });
  } catch (err) {
    next(err);
  }
};

module.exports = { createReport, listReports, getReport, updateReport, approveReport, rejectReport, updateStatus, deleteReport };
