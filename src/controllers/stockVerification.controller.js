const sequelize = require("../config/database");
const { Op } = require("sequelize");
const {
  buildZoneLookupWhere, buildStateLookupWhere,
} = require("../utils/stateOfficeScope");
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
    const where = await buildZoneLookupWhere(req.user);
    const zones = await ZonalOffice.findAll({ where, order: [["description", "ASC"]] });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
};

const getStates = async (req, res, next) => {
  try {
    const where = await buildStateLookupWhere(req.user, req.query);
    const states = await StateOffice.findAll({ where, order: [["description", "ASC"], ["code", "ASC"]] });
    const isLegacyCode = (code) => /^SO-\d+$/i.test(code || "");
    const byDescription = new Map();
    for (const state of states) {
      const key = state.description.trim().toLowerCase();
      const existing = byDescription.get(key);
      if (!existing || (isLegacyCode(existing.code) && !isLegacyCode(state.code))) {
        byDescription.set(key, state);
      }
    }
    const data = Array.from(byDescription.values())
      .sort((a, b) => a.description.localeCompare(b.description));
    res.json({ success: true, data });
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
    if (req.query.state_id) where.state_id = req.query.state_id;
    if (req.query.unit_id)  where.unit_id  = req.query.unit_id;

    const status = String(req.query.status || "all").toLowerCase();
    if (status === "active") {
      where.is_active = { [Op.eq]: 1 };
    } else if (status === "inactive") {
      where.is_active = { [Op.eq]: 0 };
    }
    // status === "all" → no is_active constraint

    const assets = await StockAsset.findAll({
      where,
      include: [
        { model: StateOffice, as: "state", attributes: ["id", "description"] },
        { model: Unit,        as: "unit",  attributes: ["id", "name"] },
      ],
      order: [["item_class", "ASC"], ["item_description", "ASC"]],
    });

    const data = assets.map((row) => {
      const json = row.toJSON();
      json.is_active = json.is_active === true || json.is_active === 1;
      return json;
    });

    res.json({ success: true, data });
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
    const { state_id, unit_id, item_class, item_description, asset_tag, book_balance, is_active } = req.body;
    await asset.update({
      state_id, unit_id: unit_id || null, item_class, item_description,
      asset_tag: asset_tag || null, book_balance: book_balance || 0,
      ...(typeof is_active === "boolean" ? { is_active } : {}),
    });
    res.json({ success: true, data: asset });
  } catch (err) { next(err); }
};

const setAssetStatus = async (req, res, next) => {
  try {
    const asset = await StockAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    const raw = req.body.is_active;
    const active = raw === true || raw === 1 || raw === "1" || raw === "true";
    await asset.update({ is_active: active });
    const json = asset.toJSON();
    json.is_active = json.is_active === true || json.is_active === 1;
    res.json({
      success: true,
      message: active ? "Asset reactivated" : "Asset deactivated",
      data: json,
    });
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

const countByField = (rows, field) =>
  Object.entries(
    rows.reduce((acc, row) => {
      const k = row[field] || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ [field]: name, count }));

const getDashboard = async (req, res, next) => {
  try {
    const { buildStateOfficeListWhere } = require("../utils/stateOfficeScope");
    const where = await buildStateOfficeListWhere(req.user, req.query);

    const [verifications, assets, items] = await Promise.all([
      StockVerification.findAll({
        where,
        attributes: ["id", "status", "stocktaking_type", "verification_date", "state_id", "zone_id"],
      }),
      StockAsset.findAll({
        where: {
          ...(where.state_id ? { state_id: where.state_id } : {}),
        },
        attributes: ["id", "is_active", "state_id"],
      }),
      StockVerificationItem.findAll({
        attributes: ["id", "verification_id", "variance", "condition", "book_balance", "physical_count"],
        include: [{
          model: StockVerification,
          as: "verification",
          attributes: [],
          where,
          required: true,
        }],
      }),
    ]);

    const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0, 7) : null);
    const monthlyMap = {};
    verifications.forEach((v) => {
      const key = monthKey(v.verification_date);
      if (!key) return;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, verifications: 0, approved: 0 };
      monthlyMap[key].verifications += 1;
      if (v.status === "approved") monthlyMap[key].approved += 1;
    });

    const assetsActive = assets.filter((a) => a.is_active === true || a.is_active === 1).length;
    const itemsWithVariance = items.filter((i) => i.variance !== 0).length;
    const itemsBadCondition = items.filter((i) => i.condition === "bad").length;

    const stateIds = [...new Set(verifications.map((v) => v.state_id).filter(Boolean))];
    const stateRows = stateIds.length
      ? await StateOffice.findAll({ where: { id: stateIds }, attributes: ["id", "description"] })
      : [];
    const stateNameById = Object.fromEntries(stateRows.map((s) => [s.id, s.description]));

    const stateCounts = {};
    verifications.forEach((v) => {
      if (!v.state_id) return;
      if (!stateCounts[v.state_id]) stateCounts[v.state_id] = 0;
      stateCounts[v.state_id] += 1;
    });
    const state_activity = Object.entries(stateCounts)
      .map(([state_id, count]) => ({
        state_id: Number(state_id),
        state_name: stateNameById[state_id] ?? null,
        verification_count: count,
      }))
      .sort((a, b) => b.verification_count - a.verification_count)
      .slice(0, 15);

    res.json({
      success: true,
      data: {
        total_verifications: verifications.length,
        total_assets: assets.length,
        assets_active: assetsActive,
        assets_inactive: assets.length - assetsActive,
        items_verified: items.length,
        items_with_variance: itemsWithVariance,
        items_bad_condition: itemsBadCondition,
        verification_by_status: countByField(verifications, "status"),
        verification_by_type: countByField(verifications, "stocktaking_type"),
        monthly_activity: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
        state_activity,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getDashboardDrill = async (req, res, next) => {
  try {
    const { buildStateOfficeListWhere } = require("../utils/stateOfficeScope");
    const { buildZoneBreakdown, buildStateBreakdownInZone } = require("../utils/dashboardDrillGeo");
    const segment = String(req.query.segment || "verifications");
    const recordSegment = req.query.record_segment || "verifications";
    const where = await buildStateOfficeListWhere(req.user, req.query);
    const geoInclude = [
      { model: ZonalOffice, as: "zone", attributes: ["description"] },
      { model: StateOffice, as: "state", attributes: ["description"] },
      { model: Department, as: "department", attributes: ["name"] },
    ];
    const stateWithZoneInclude = [{
      model: StateOffice, as: "state", attributes: ["description"],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["description"] }],
    }];

    const countStockDrillRecord = async (query, rs) => {
      const q = { ...query };
      delete q.segment;
      delete q.record_segment;
      const scoped = await buildStateOfficeListWhere(req.user, q);
      if (rs === "assets") {
        const assetWhere = {};
        if (scoped.state_id) assetWhere.state_id = scoped.state_id;
        else if (scoped.zone_id) {
          const states = await StateOffice.findAll({ where: { zonal_id: scoped.zone_id }, attributes: ["id"] });
          if (!states.length) return 0;
          assetWhere.state_id = { [Op.in]: states.map((s) => s.id) };
        }
        if (query.active === "1") assetWhere.is_active = { [Op.eq]: 1 };
        if (query.active === "0") assetWhere.is_active = { [Op.eq]: 0 };
        return StockAsset.count({ where: assetWhere });
      }
      if (rs === "variance_items") {
        const itemWhere = {};
        if (query.has_variance === "1") itemWhere.variance = { [Op.ne]: 0 };
        if (query.condition === "bad") itemWhere.condition = "bad";
        return StockVerificationItem.count({
          where: itemWhere,
          include: [{
            model: StockVerification,
            as: "verification",
            where: scoped,
            required: true,
          }],
        });
      }
      if (query.status) scoped.status = query.status;
      if (query.type) scoped.stocktaking_type = query.type;
      if (query.month) scoped.verification_date = { [Op.like]: `${query.month}%` };
      return StockVerification.count({ where: scoped });
    };

    if (segment === "zone_breakdown") {
      const data = await buildZoneBreakdown((zoneId) =>
        countStockDrillRecord({ ...req.query, zone_id: String(zoneId) }, recordSegment),
      );
      return res.json({ success: true, data });
    }

    if (segment === "state_breakdown") {
      const stateId = req.query.state_id;
      const zoneId = req.query.zone_id;
      if (!stateId && zoneId) {
        const data = await buildStateBreakdownInZone(zoneId, (stId) =>
          countStockDrillRecord({ ...req.query, zone_id: String(zoneId), state_id: String(stId) }, recordSegment),
        );
        return res.json({ success: true, data });
      }
      if (stateId && !req.query.record_segment) {
        const stWhere = { ...where, state_id: stateId };
        const count = await StockVerification.count({ where: stWhere });
        const state = await StateOffice.findByPk(stateId, {
          attributes: ["description"],
          include: [{ model: ZonalOffice, as: "zone", attributes: ["description"] }],
        });
        return res.json({
          success: true,
          data: [{
            id: stateId,
            reference: null,
            title: `${state?.description || "State"} — Verifications`,
            subtitle: "All stocktaking sessions",
            status: String(count),
            state_name: state?.description,
            zone_name: state?.zone?.description ?? null,
            meta: "segment:verifications",
          }],
        });
      }
      if (!stateId && !zoneId) {
        return res.status(422).json({ success: false, message: "state_id or zone_id required" });
      }
    }

    if (segment === "assets") {
      const assetWhere = {};
      if (where.state_id) assetWhere.state_id = where.state_id;
      else if (where.zone_id) {
        const states = await StateOffice.findAll({ where: { zonal_id: where.zone_id }, attributes: ["id"] });
        if (!states.length) return res.json({ success: true, data: [] });
        assetWhere.state_id = { [Op.in]: states.map((s) => s.id) };
      }
      if (req.query.active === "1") assetWhere.is_active = { [Op.eq]: 1 };
      if (req.query.active === "0") assetWhere.is_active = { [Op.eq]: 0 };
      const rows = await StockAsset.findAll({
        where: assetWhere,
        include: stateWithZoneInclude,
        order: [["asset_tag", "ASC"]],
        limit: 200,
      });
      return res.json({
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          reference: r.asset_tag,
          title: r.item_description || r.item_class,
          subtitle: r.item_class,
          status: r.is_active === true || r.is_active === 1 ? "active" : "inactive",
          date: null,
          state_name: r.state?.description ?? null,
          zone_name: r.state?.zone?.description ?? null,
          state_id: r.state_id ?? r.state?.id ?? null,
          zone_id: r.state?.zonal_id ?? r.state?.zone?.id ?? null,
          meta: r.item_class,
        })),
      });
    }

    if (segment === "variance_items") {
      const itemWhere = {};
      if (req.query.has_variance === "1") itemWhere.variance = { [Op.ne]: 0 };
      if (req.query.condition === "bad") itemWhere.condition = "bad";
      const rows = await StockVerificationItem.findAll({
        where: itemWhere,
        include: [{
          model: StockVerification,
          as: "verification",
          where,
          required: true,
          include: geoInclude,
        }],
        limit: 200,
      });
      return res.json({
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          reference: r.asset_tag,
          title: r.item_description,
          subtitle: r.verification?.reference_id,
          status: r.condition,
          date: r.verification?.verification_date,
          state_name: r.verification?.state?.description ?? null,
          zone_name: r.verification?.zone?.description ?? null,
          state_id: r.verification?.state_id ?? null,
          zone_id: r.verification?.zone_id ?? null,
          meta: `Variance ${r.variance}`,
        })),
      });
    }

    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.stocktaking_type = req.query.type;
    if (req.query.month) where.verification_date = { [Op.like]: `${req.query.month}%` };

    const rows = await StockVerification.findAll({
      where,
      include: geoInclude,
      order: [["verification_date", "DESC"]],
      limit: 200,
    });
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        reference: r.reference_id,
        title: `${r.stocktaking_type} verification`,
        subtitle: [r.department?.name, r.unit?.name].filter(Boolean).join(" · ") || r.store_keeper,
        status: r.status,
        date: r.verification_date,
        state_name: r.state?.description ?? null,
        zone_name: r.zone?.description ?? null,
        state_id: r.state_id ?? r.state?.id ?? null,
        zone_id: r.zone_id ?? r.zone?.id ?? null,
        meta: r.audit_officer,
      })),
    });
  } catch (err) {
    next(err);
  }
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
  getAssets, createAsset, updateAsset, setAssetStatus,
  createVerification, listVerifications, getVerification,
  updateVerification, updateStatus, getDashboard, getDashboardDrill,
};
