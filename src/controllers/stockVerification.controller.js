const sequelize = require("../config/database");
const {
  StockVerification, StockVerificationItem, StockAsset,
  ZonalOffice, StateOffice, Department, Unit,
} = require("../models");

// ─── Reference ID generator ───────────────────────────────────────────────────

const generateRefId = async (t) => {
  const year = new Date().getFullYear();
  const count = await StockVerification.count({ transaction: t });
  return `SV-${year}-${String(count + 1).padStart(5, "0")}`;
};

// ─── Lookup endpoints ─────────────────────────────────────────────────────────

const getZones = async (req, res, next) => {
  try {
    const zones = await ZonalOffice.findAll({ order: [["description", "ASC"]] });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
};

const getStates = async (req, res, next) => {
  try {
    const where = req.query.zone_id ? { zonal_id: req.query.zone_id } : {};
    const states = await StateOffice.findAll({ where, order: [["description", "ASC"]] });
    res.json({ success: true, data: states });
  } catch (err) { next(err); }
};

const getDepartments = async (req, res, next) => {
  try {
    // Departments are global — not scoped to a state. Ignore state_id filter.
    const where = req.query.department_id ? { id: req.query.department_id } : {};
    const depts = await Department.findAll({ where, order: [["name", "ASC"]] });
    res.json({ success: true, data: depts });
  } catch (err) { next(err); }
};

const getUnits = async (req, res, next) => {
  try {
    const where = req.query.department_id ? { department_id: req.query.department_id } : {};
    const units = await Unit.findAll({ where, order: [["name", "ASC"]] });
    res.json({ success: true, data: units });
  } catch (err) { next(err); }
};

/**
 * GET /api/stock/assets?state_id=&unit_id=
 * Returns assets for a given state (optionally filtered by unit).
 */
const getAssets = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.state_id)  where.state_id = req.query.state_id;
    if (req.query.unit_id)   where.unit_id  = req.query.unit_id;
    const assets = await StockAsset.findAll({
      where,
      include: [
        { model: StateOffice, as: "state", attributes: ["id","description"] },
        { model: Unit,        as: "unit",  attributes: ["id","name"] },
      ],
      order: [["item_class", "ASC"], ["item_description", "ASC"]],
    });
    res.json({ success: true, data: assets });
  } catch (err) { next(err); }
};

const createAsset = async (req, res, next) => {
  try {
    const { state_id, unit_id, item_class, item_description, asset_tag, book_balance } = req.body;
    const asset = await StockAsset.create({ state_id, unit_id: unit_id || null, item_class, item_description, asset_tag: asset_tag || null, book_balance: book_balance || 0 });
    res.status(201).json({ success: true, data: asset });
  } catch (err) { next(err); }
};

const updateAsset = async (req, res, next) => {
  try {
    const asset = await StockAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    const { state_id, unit_id, item_class, item_description, asset_tag, book_balance } = req.body;
    await asset.update({ state_id, unit_id: unit_id || null, item_class, item_description, asset_tag: asset_tag || null, book_balance: book_balance || 0 });
    res.json({ success: true, data: asset });
  } catch (err) { next(err); }
};

const deleteAsset = async (req, res, next) => {
  try {
    const asset = await StockAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    await asset.destroy();
    res.json({ success: true, message: "Asset deleted" });
  } catch (err) { next(err); }
};

// ─── Verification CRUD ────────────────────────────────────────────────────────

/**
 * POST /api/stock/verifications
 * Body: { zone_id, state_id, department_id, unit_id, stocktaking_type,
 *         store_keeper, audit_officer, verification_date, submitted_by,
 *         items: [{ asset_id?, item_class, item_description, asset_tag,
 *                   book_balance, physical_count, condition, remarks }] }
 */
const createVerification = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      zone_id, state_id, department_id, unit_id,
      stocktaking_type, store_keeper, audit_officer,
      verification_date, submitted_by, status = "draft", items = [],
    } = req.body;

    const reference_id = await generateRefId(t);

    const verification = await StockVerification.create({
      reference_id, zone_id, state_id, department_id, unit_id,
      stocktaking_type, store_keeper, audit_officer,
      verification_date, submitted_by, status,
    }, { transaction: t });

    if (items.length > 0) {
      const rows = items.map(item => ({
        verification_id:  verification.id,
        asset_id:         item.asset_id || null,
        item_class:       item.item_class,
        item_description: item.item_description,
        asset_tag:        item.asset_tag || null,
        book_balance:     Number(item.book_balance) || 0,
        physical_count:   Number(item.physical_count) || 0,
        variance:         (Number(item.book_balance) || 0) - (Number(item.physical_count) || 0),
        condition:        item.condition || "good",
        remarks:          item.remarks || null,
      }));
      await StockVerificationItem.bulkCreate(rows, { transaction: t });
    }

    await t.commit();
    const full = await findVerification(verification.id);
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * GET /api/stock/verifications
 * Supports ?zone_id=&state_id=&status=&type=
 */
const listVerifications = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.zone_id)  where.zone_id  = req.query.zone_id;
    if (req.query.state_id) where.state_id = req.query.state_id;
    if (req.query.status)   where.status   = req.query.status;
    if (req.query.type)     where.stocktaking_type = req.query.type;

    const list = await StockVerification.findAll({
      where,
      include: [
        { model: ZonalOffice,  as: "zone",       attributes: ["id","description"] },
        { model: StateOffice,  as: "state",      attributes: ["id","description"] },
        { model: Department,   as: "department", attributes: ["id","name"] },
        { model: Unit,         as: "unit",       attributes: ["id","name"] },
      ],
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
};

/**
 * GET /api/stock/verifications/:id
 */
const getVerification = async (req, res, next) => {
  try {
    const v = await findVerification(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: v });
  } catch (err) { next(err); }
};

/**
 * PUT /api/stock/verifications/:id
 * Full update — replaces items.
 */
const updateVerification = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const v = await StockVerification.findByPk(req.params.id, { transaction: t });
    if (!v) { await t.rollback(); return res.status(404).json({ success: false, message: "Not found" }); }

    const {
      zone_id, state_id, department_id, unit_id,
      stocktaking_type, store_keeper, audit_officer,
      verification_date, submitted_by, status, items = [],
    } = req.body;

    await v.update({
      zone_id, state_id, department_id, unit_id,
      stocktaking_type, store_keeper, audit_officer,
      verification_date, submitted_by,
      ...(status && { status }),
    }, { transaction: t });

    await StockVerificationItem.destroy({ where: { verification_id: v.id }, transaction: t });

    if (items.length > 0) {
      const rows = items.map(item => ({
        verification_id:  v.id,
        asset_id:         item.asset_id || null,
        item_class:       item.item_class,
        item_description: item.item_description,
        asset_tag:        item.asset_tag || null,
        book_balance:     Number(item.book_balance) || 0,
        physical_count:   Number(item.physical_count) || 0,
        variance:         (Number(item.book_balance) || 0) - (Number(item.physical_count) || 0),
        condition:        item.condition || "good",
        remarks:          item.remarks || null,
      }));
      await StockVerificationItem.bulkCreate(rows, { transaction: t });
    }

    await t.commit();
    const full = await findVerification(v.id);
    res.json({ success: true, data: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * PATCH /api/stock/verifications/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const allowed = ["draft", "submitted", "approved"];
    const { status } = req.body;
    if (!allowed.includes(status)) return res.status(422).json({ success: false, message: "Invalid status" });

    const v = await StockVerification.findByPk(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: "Not found" });

    await v.update({ status });
    res.json({ success: true, data: v });
  } catch (err) { next(err); }
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const findVerification = (id) =>
  StockVerification.findByPk(id, {
    include: [
      { model: ZonalOffice,  as: "zone",       attributes: ["id","description"] },
      { model: StateOffice,  as: "state",      attributes: ["id","description"] },
      { model: Department,   as: "department", attributes: ["id","name"] },
      { model: Unit,         as: "unit",       attributes: ["id","name"] },
      { model: StockVerificationItem, as: "items" },
    ],
  });

module.exports = {
  getZones, getStates, getDepartments, getUnits,
  getAssets, createAsset, updateAsset, deleteAsset,
  createVerification, listVerifications, getVerification,
  updateVerification, updateStatus,
};
