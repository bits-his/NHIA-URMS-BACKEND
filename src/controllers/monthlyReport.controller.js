const sequelize = require("../config/database");
const { FinanceMonthlyReport, ProgrammesMonthlyReport, SqaMonthlyReport, StateOffice } = require("../models");
const { buildMonthlyListWhere } = require("../utils/monthlyReportScope");

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Approval chain ───────────────────────────────────────────────────────────
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
    auditApprove:   (actor) => ({}),  // no extra audit field for sdo on monthly
    auditReject:    (actor, reason) => ({ rejected_by: actor, rejected_at: new Date(), rejection_reason: reason }),
  },
};

// ── Reference ID generator ────────────────────────────────────────────────────
const genRefId = async (Model, prefix, t) => {
  const year = new Date().getFullYear();
  const count = await Model.count({ transaction: t });
  return `${prefix}-${year}-${String(count + 1).padStart(5, "0")}`;
};

// ── Generic CRUD + approval factory ──────────────────────────────────────────
const makeController = (Model, prefix) => ({

  create: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const reference_id = await genRefId(Model, prefix, t);
      const record = await Model.create(
        { reference_id, ...req.body, status: req.body.status || "draft",
          submitted_by: req.body.submitted_by || req.user?.name || null },
        { transaction: t }
      );
      await t.commit();
      res.status(201).json({ success: true, data: record });
    } catch (err) { await t.rollback(); next(err); }
  },

  list: async (req, res, next) => {
    try {
      const where = await buildMonthlyListWhere(req.user, req.query, StateOffice);

      const records = await Model.findAll({
        where,
        include: [{ model: StateOffice, as: "state", attributes: ["id","description"] }],
        order: [["reporting_year","DESC"],["reporting_month","DESC"]],
      });
      res.json({ success: true, data: records });
    } catch (err) { next(err); }
  },

  get: async (req, res, next) => {
    try {
      const record = await Model.findByPk(req.params.id, {
        include: [{ model: StateOffice, as: "state", attributes: ["id","description"] }],
      });
      if (!record) return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: "Not found" });
      if (!["draft", "rejected"].includes(record.status)) {
        return res.status(403).json({ success: false, message: "Cannot edit a report under review or approved" });
      }
      await record.update(req.body);
      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // Role-enforced approval
  approve: async (req, res, next) => {
    try {
      const role = req.user?.role;
      const chain = CHAIN[role];
      if (!chain) return res.status(403).json({ success: false, message: "Your role cannot approve reports" });

      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: "Not found" });

      if (record.status !== chain.requiredStatus) {
        return res.status(422).json({
          success: false,
          message: `Cannot approve: report is "${record.status}", expected "${chain.requiredStatus}"`,
        });
      }

      const actor = req.user.name || req.user.staff_id;
      await record.update({
        status: chain.approveStatus,
        ...chain.auditApprove(actor),
        ...(req.body.note && { state_review_note: req.body.note }),
      });

      res.json({ success: true, data: record, message: "Report approved and forwarded" });
    } catch (err) { next(err); }
  },

  // Role-enforced rejection
  reject: async (req, res, next) => {
    try {
      const role = req.user?.role;
      const chain = CHAIN[role];
      if (!chain) return res.status(403).json({ success: false, message: "Your role cannot reject reports" });

      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: "Not found" });

      if (record.status !== chain.requiredStatus) {
        return res.status(422).json({
          success: false,
          message: `Cannot reject: report is "${record.status}", expected "${chain.requiredStatus}"`,
        });
      }

      if (!req.body.reason) {
        return res.status(422).json({ success: false, message: "Rejection reason is required" });
      }

      const actor = req.user.name || req.user.staff_id;
      await record.update({ status: "rejected", ...chain.auditReject(actor, req.body.reason) });
      res.json({ success: true, data: record, message: "Report rejected" });
    } catch (err) { next(err); }
  },

  // Admin-only generic status override
  updateStatus: async (req, res, next) => {
    try {
      if (req.user?.role !== "admin") return res.status(403).json({ success: false, message: "Admin only" });
      const allowed = ["draft","submitted","under_review","zonal_review","approved","rejected"];
      if (!allowed.includes(req.body.status))
        return res.status(422).json({ success: false, message: "Invalid status" });
      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: "Not found" });
      await record.update({ status: req.body.status });
      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  aggregate: async (req, res, next) => {
    try {
      const { state_id, year } = req.query;
      if (!state_id || !year)
        return res.status(422).json({ success: false, message: "state_id and year required" });
      const records = await Model.findAll({
        where: { state_id, reporting_year: year },
        order: [["reporting_month","ASC"]],
      });
      res.json({ success: true, data: records, count: records.length });
    } catch (err) { next(err); }
  },
});

module.exports = {
  finance:    makeController(FinanceMonthlyReport,    "FIN"),
  programmes: makeController(ProgrammesMonthlyReport, "PRG"),
  sqa:        makeController(SqaMonthlyReport,        "SQA"),
};
