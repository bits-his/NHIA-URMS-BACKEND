/**
 * Store Management pack — inventory, stock movements (prepayment IN / issue OUT),
 * assets, and physical asset verification. Business-key PKs only.
 */
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  StoreInventoryItem,
  StockMovement,
  StoreAsset,
  PhysicalAssetVerification,
  PhysicalAssetVerificationItem,
  Department,
  StateOffice,
  ZonalOffice,
} = require("../models");

async function nextCode(Model, field, prefix, pad = 5) {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}${year}-`;
  const last = await Model.findOne({
    where: { [field]: { [Op.like]: `${fullPrefix}%` } },
    order: [[field, "DESC"]],
  });
  let next = 1;
  if (last?.[field]) {
    const n = parseInt(String(last[field]).slice(fullPrefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${fullPrefix}${String(next).padStart(pad, "0")}`;
}

function geoFromUser(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function mapInventory(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  return {
    ...p,
    id: p.item_code,
    itemCode: p.item_code,
    quantityInStock: Number(p.quantity_on_hand),
    quantity_on_hand: Number(p.quantity_on_hand),
    reorderLevel: p.reorder_level != null ? Number(p.reorder_level) : null,
    unitPrice: p.unit_price != null ? Number(p.unit_price) : null,
    unitOfMeasure: p.uom,
    storeLocation: p.store_location,
  };
}

function mapMovement(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  return {
    ...p,
    id: p.movement_code,
    movementCode: p.movement_code,
    itemCode: p.item_code,
    qty: Number(p.qty),
    movementDate: p.movement_date,
    referenceDoc: p.reference_doc,
    supplierOrContractor: p.supplier_or_contractor,
    recipientName: p.recipient_name,
    receivingDepartmentCode: p.receiving_department_code,
    unitPrice: p.unit_price != null ? Number(p.unit_price) : null,
  };
}

function mapAsset(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  return {
    ...p,
    id: p.asset_code,
    assetCode: p.asset_code,
    assetNumber: p.asset_number || p.asset_code,
    nhiaTagNumber: p.nhia_tag_number,
    physicalCondition: p.physical_condition,
    verificationStatus: p.verification_status,
    lastVerificationDate: p.last_verification_date,
    specificLocation: p.specific_location,
    acquisitionDate: p.acquisition_date,
    acquisitionCost: p.acquisition_cost != null ? Number(p.acquisition_cost) : null,
  };
}

function mapPav(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const items = (p.items || []).map((it) => ({
    ...it,
    id: `${it.reference_no}-${it.line_no}`,
    assetId: it.asset_code,
    assetCode: it.asset_code,
    assetName: it.asset_name,
    bookBalance: Number(it.book_balance),
    physicalCount: Number(it.physical_count),
    variance: Number(it.variance),
  }));
  return {
    ...p,
    id: p.reference_no,
    referenceNo: p.reference_no,
    stocktakingType: p.stocktaking_type,
    verificationDate: p.verification_date,
    storeKeeper: p.store_keeper,
    auditOfficer: p.audit_officer,
    items,
  };
}

async function postMovement({
  item_code, direction, movement_type, qty, movement_date,
  reference_doc, supplier_or_contractor, recipient_name,
  receiving_department_code, unit_price, remarks, status = "POSTED",
  geo, userId, transaction,
}) {
  const item = await StoreInventoryItem.findByPk(item_code, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!item) {
    const err = new Error(`Inventory item not found: ${item_code}`);
    err.status = 404;
    throw err;
  }

  const q = Number(qty);
  if (!(q > 0)) {
    const err = new Error("Quantity must be greater than zero");
    err.status = 422;
    throw err;
  }

  const balance = Number(item.quantity_on_hand) || 0;
  const nextBalance = direction === "IN" ? balance + q : balance - q;
  if (direction === "OUT" && nextBalance < 0) {
    const err = new Error(`Insufficient stock for ${item_code}. On hand: ${balance}`);
    err.status = 422;
    throw err;
  }

  const prefix = movement_type === "PREPAYMENT" ? "PAR-"
    : movement_type === "ISSUE" ? "SIV-"
      : direction === "IN" ? "SIN-" : "SOUT-";
  const code = await nextCode(StockMovement, "movement_code", prefix);

  const movement = await StockMovement.create({
    movement_code: code,
    item_code,
    direction,
    movement_type,
    qty: q,
    movement_date: movement_date || new Date().toISOString().slice(0, 10),
    reference_doc: reference_doc || null,
    supplier_or_contractor: supplier_or_contractor || null,
    recipient_name: recipient_name || null,
    receiving_department_code: receiving_department_code || null,
    unit_price: unit_price != null ? Number(unit_price) : item.unit_price,
    remarks: remarks || null,
    status,
    ...geo,
    created_by_user_id: userId || null,
  }, { transaction });

  if (status === "POSTED") {
    await item.update({ quantity_on_hand: nextBalance }, { transaction });
  }

  return { movement, item, balance_after: status === "POSTED" ? nextBalance : balance };
}

// ─── Inventory ───────────────────────────────────────────────────────────────

const listInventory = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.state_code || req.query.state_id) where.state_code = req.query.state_code || req.query.state_id;
    if (req.query.zonal_code || req.query.zone_id) where.zonal_code = req.query.zonal_code || req.query.zone_id;
    const rows = await StoreInventoryItem.findAll({
      where,
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
        { model: Department, as: "department", attributes: ["department_code", "name"] },
      ],
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: rows.map(mapInventory) });
  } catch (err) { next(err); }
};

const getInventory = async (req, res, next) => {
  try {
    const row = await StoreInventoryItem.findByPk(req.params.id, {
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
      ],
    });
    if (!row) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: mapInventory(row) });
  } catch (err) { next(err); }
};

const createInventory = async (req, res, next) => {
  try {
    const body = req.body || {};
    const geo = geoFromUser(req.user, body);
    const item_code = body.item_code || body.itemCode || await nextCode(StoreInventoryItem, "item_code", "ITEM-");
    const row = await StoreInventoryItem.create({
      item_code,
      name: body.name,
      category: body.category || null,
      uom: body.uom || body.unitOfMeasure || "Unit",
      quantity_on_hand: Number(body.quantity_on_hand ?? body.quantityInStock ?? 0),
      reorder_level: body.reorder_level ?? body.reorderLevel ?? 0,
      unit_price: body.unit_price ?? body.unitPrice ?? 0,
      store_location: body.store_location || body.storeLocation || null,
      status: body.status || "ACTIVE",
      ...geo,
      created_by_user_id: req.user?.id || null,
    });
    res.status(201).json({ success: true, data: mapInventory(row) });
  } catch (err) { next(err); }
};

const listItemMovements = async (req, res, next) => {
  try {
    const rows = await StockMovement.findAll({
      where: { item_code: req.params.id },
      order: [["movement_date", "DESC"], ["createdAt", "DESC"]],
      limit: 200,
    });
    res.json({ success: true, data: rows.map(mapMovement) });
  } catch (err) { next(err); }
};

// ─── Prepayment (IN movements) ───────────────────────────────────────────────

const listPrepayments = async (req, res, next) => {
  try {
    const rows = await StockMovement.findAll({
      where: { movement_type: "PREPAYMENT", direction: "IN" },
      include: [{ model: StoreInventoryItem, as: "item", attributes: ["item_code", "name", "uom"] }],
      order: [["movement_date", "DESC"]],
    });
    res.json({
      success: true,
      data: rows.map((r) => {
        const m = mapMovement(r);
        return {
          ...m,
          controlNumber: m.referenceDoc || m.movementCode,
          entryDate: m.movementDate,
          contractorName: m.supplierOrContractor,
          itemDescription: r.item?.name || m.itemCode,
          quantitySupplied: m.qty,
          rate: m.unitPrice,
        };
      }),
    });
  } catch (err) { next(err); }
};

const getPrepayment = async (req, res, next) => {
  try {
    const row = await StockMovement.findByPk(req.params.id, {
      include: [{ model: StoreInventoryItem, as: "item" }],
    });
    if (!row || row.movement_type !== "PREPAYMENT") {
      return res.status(404).json({ success: false, message: "Prepayment not found" });
    }
    const m = mapMovement(row);
    res.json({
      success: true,
      data: {
        ...m,
        controlNumber: m.referenceDoc || m.movementCode,
        entryDate: m.movementDate,
        contractorName: m.supplierOrContractor,
        itemDescription: row.item?.name || m.itemCode,
        quantitySupplied: m.qty,
        rate: m.unitPrice,
      },
    });
  } catch (err) { next(err); }
};

const createPrepayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const body = req.body || {};
    const geo = geoFromUser(req.user, body);
    let item_code = body.item_code || body.itemCode;

    if (!item_code) {
      item_code = await nextCode(StoreInventoryItem, "item_code", "ITEM-");
      await StoreInventoryItem.create({
        item_code,
        name: body.itemDescription || body.name || body.item_name || "Stock item",
        category: body.category || body.storeCategory || null,
        uom: body.uom || body.unitOfMeasure || "Unit",
        quantity_on_hand: 0,
        unit_price: body.rate ?? body.unit_price ?? 0,
        store_location: body.store_location || null,
        status: "ACTIVE",
        ...geo,
        created_by_user_id: req.user?.id || null,
      }, { transaction: t });
    }

    const qty = Number(body.quantitySupplied ?? body.qty ?? body.quantity ?? 0);
    const { movement, balance_after } = await postMovement({
      item_code,
      direction: "IN",
      movement_type: "PREPAYMENT",
      qty,
      movement_date: body.entryDate || body.movement_date || body.date,
      reference_doc: body.controlNumber || body.reference_doc || null,
      supplier_or_contractor: body.contractorName || body.supplier_or_contractor || null,
      unit_price: body.rate ?? body.unit_price,
      remarks: body.remarks || body.itemDescription || null,
      geo,
      userId: req.user?.id,
      transaction: t,
    });

    await t.commit();
    const m = mapMovement(movement);
    res.status(201).json({
      success: true,
      data: {
        ...m,
        controlNumber: m.referenceDoc || m.movementCode,
        quantitySupplied: m.qty,
        balance_after,
      },
    });
  } catch (err) {
    await t.rollback();
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// ─── Issuance (OUT movements) ────────────────────────────────────────────────

const listIssues = async (req, res, next) => {
  try {
    const rows = await StockMovement.findAll({
      where: { movement_type: "ISSUE", direction: "OUT" },
      include: [
        { model: StoreInventoryItem, as: "item", attributes: ["item_code", "name", "uom"] },
        { model: Department, as: "receiving_department", attributes: ["department_code", "name"] },
      ],
      order: [["movement_date", "DESC"]],
    });
    res.json({
      success: true,
      data: rows.map((r) => {
        const m = mapMovement(r);
        return {
          ...m,
          issueNumber: m.movementCode,
          issueDate: m.movementDate,
          department: r.receiving_department?.name || m.receivingDepartmentCode,
          recipientName: m.recipientName,
          issuedBy: null,
          status: m.status,
          lineItems: [{
            inventoryItemId: m.itemCode,
            itemCode: m.itemCode,
            name: r.item?.name,
            qty: m.qty,
          }],
        };
      }),
    });
  } catch (err) { next(err); }
};

const createIssue = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const body = req.body || {};
    const geo = geoFromUser(req.user, body);
    const lines = Array.isArray(body.lineItems) && body.lineItems.length
      ? body.lineItems
      : [{
          inventoryItemId: body.item_code || body.itemCode || body.inventoryItemId,
          qty: body.qty || body.quantity,
        }];

    let receiving_department_code =
      body.receiving_department_code || body.department_code || body.departmentCode || null;
    if (receiving_department_code) {
      const dept = await Department.findByPk(receiving_department_code, { transaction: t });
      if (!dept) {
        // FE may send a display name; keep movement without invalid FK
        receiving_department_code = null;
      }
    }

    const created = [];
    for (const line of lines) {
      const item_code = line.inventoryItemId || line.item_code || line.itemCode;
      const qty = Number(line.qty ?? line.quantity ?? 0);
      const { movement } = await postMovement({
        item_code,
        direction: "OUT",
        movement_type: "ISSUE",
        qty,
        movement_date: body.issueDate || body.movement_date || body.date,
        recipient_name: body.recipientName || body.recipient_name,
        receiving_department_code,
        remarks: body.remarks || body.department || null,
        geo,
        userId: req.user?.id,
        transaction: t,
      });
      created.push(mapMovement(movement));
    }

    await t.commit();
    const primary = created[0];
    res.status(201).json({
      success: true,
      data: {
        ...primary,
        issueNumber: primary.movementCode,
        lineItems: created.map((c) => ({
          inventoryItemId: c.itemCode,
          itemCode: c.itemCode,
          qty: c.qty,
        })),
      },
    });
  } catch (err) {
    await t.rollback();
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// ─── Assets ──────────────────────────────────────────────────────────────────

const listAssets = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.state_code || req.query.state_id) where.state_code = req.query.state_code || req.query.state_id;
    if (req.query.zonal_code || req.query.zone_id) where.zonal_code = req.query.zonal_code || req.query.zone_id;
    const rows = await StoreAsset.findAll({
      where,
      include: [
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
      ],
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: rows.map(mapAsset) });
  } catch (err) { next(err); }
};

const getAsset = async (req, res, next) => {
  try {
    const row = await StoreAsset.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Asset not found" });
    res.json({ success: true, data: mapAsset(row) });
  } catch (err) { next(err); }
};

const createAsset = async (req, res, next) => {
  try {
    const body = req.body || {};
    const geo = geoFromUser(req.user, body);
    const asset_code = body.asset_code || body.assetCode || await nextCode(StoreAsset, "asset_code", "AST-");
    const row = await StoreAsset.create({
      asset_code,
      asset_number: body.asset_number || body.assetNumber || asset_code,
      nhia_tag_number: body.nhia_tag_number || body.nhiaTagNumber || null,
      name: body.name,
      description: body.description || null,
      category: body.category || null,
      custodian: body.custodian || null,
      specific_location: body.specific_location || body.specificLocation || null,
      physical_condition: body.physical_condition || body.physicalCondition || "Good",
      verification_status: body.verification_status || body.verificationStatus || "Unverified",
      acquisition_date: body.acquisition_date || body.acquisitionDate || null,
      acquisition_cost: body.acquisition_cost ?? body.acquisitionCost ?? null,
      status: body.status || "ACTIVE",
      ...geo,
      created_by_user_id: req.user?.id || null,
    });
    res.status(201).json({ success: true, data: mapAsset(row) });
  } catch (err) { next(err); }
};

const updateAsset = async (req, res, next) => {
  try {
    const row = await StoreAsset.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Asset not found" });
    const body = req.body || {};
    await row.update({
      name: body.name ?? row.name,
      description: body.description ?? row.description,
      category: body.category ?? row.category,
      custodian: body.custodian ?? row.custodian,
      specific_location: body.specific_location ?? body.specificLocation ?? row.specific_location,
      physical_condition: body.physical_condition ?? body.physicalCondition ?? row.physical_condition,
      verification_status: body.verification_status ?? body.verificationStatus ?? row.verification_status,
      nhia_tag_number: body.nhia_tag_number ?? body.nhiaTagNumber ?? row.nhia_tag_number,
      status: body.status ?? row.status,
    });
    res.json({ success: true, data: mapAsset(row) });
  } catch (err) { next(err); }
};

// ─── Physical Asset Verification ─────────────────────────────────────────────

const listPav = async (req, res, next) => {
  try {
    const rows = await PhysicalAssetVerification.findAll({
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
      order: [["verification_date", "DESC"]],
    });
    res.json({ success: true, data: rows.map(mapPav) });
  } catch (err) { next(err); }
};

const getPav = async (req, res, next) => {
  try {
    const row = await PhysicalAssetVerification.findByPk(req.params.id, {
      include: [
        {
          model: PhysicalAssetVerificationItem,
          as: "items",
          include: [{ model: StoreAsset, as: "asset" }],
        },
      ],
    });
    if (!row) return res.status(404).json({ success: false, message: "Verification not found" });
    res.json({ success: true, data: mapPav(row) });
  } catch (err) { next(err); }
};

const createPav = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const body = req.body || {};
    const geo = geoFromUser(req.user, body);
    const reference_no = body.reference_no || body.referenceNo || await nextCode(PhysicalAssetVerification, "reference_no", "PAV-");
    const header = await PhysicalAssetVerification.create({
      reference_no,
      stocktaking_type: body.stocktaking_type || body.stocktakingType || "periodic",
      verification_date: body.verification_date || body.verificationDate || new Date().toISOString().slice(0, 10),
      store_keeper: body.store_keeper || body.storeKeeper || null,
      audit_officer: body.audit_officer || body.auditOfficer || null,
      status: body.status || "DRAFT",
      remarks: body.remarks || null,
      ...geo,
      created_by_user_id: req.user?.id || null,
    }, { transaction: t });

    const rawItems = Array.isArray(body.items) ? body.items : [];
    let line_no = 1;
    for (const it of rawItems) {
      const asset_code = it.asset_code || it.assetCode || it.assetId;
      const asset = await StoreAsset.findByPk(asset_code, { transaction: t });
      if (!asset) {
        const err = new Error(`Asset not found: ${asset_code}`);
        err.status = 422;
        throw err;
      }
      const book = Number(it.book_balance ?? it.bookBalance ?? 1);
      const physical = Number(it.physical_count ?? it.physicalCount ?? book);
      await PhysicalAssetVerificationItem.create({
        reference_no,
        line_no,
        asset_code,
        asset_name: asset.name,
        category: asset.category,
        custodian: it.custodian || asset.custodian,
        book_balance: book,
        physical_count: physical,
        variance: physical - book,
        condition: it.condition || asset.physical_condition,
        remarks: it.remarks || null,
      }, { transaction: t });
      line_no += 1;
    }

    await t.commit();
    const full = await PhysicalAssetVerification.findByPk(reference_no, {
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
    });
    res.status(201).json({ success: true, data: mapPav(full) });
  } catch (err) {
    await t.rollback();
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const updatePav = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const header = await PhysicalAssetVerification.findByPk(req.params.id, { transaction: t });
    if (!header) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Verification not found" });
    }
    const body = req.body || {};
    const nextStatus = body.status || header.status;
    await header.update({
      stocktaking_type: body.stocktaking_type || body.stocktakingType || header.stocktaking_type,
      verification_date: body.verification_date || body.verificationDate || header.verification_date,
      store_keeper: body.store_keeper || body.storeKeeper || header.store_keeper,
      audit_officer: body.audit_officer || body.auditOfficer || header.audit_officer,
      status: nextStatus,
      remarks: body.remarks ?? header.remarks,
    }, { transaction: t });

    if (Array.isArray(body.items)) {
      await PhysicalAssetVerificationItem.destroy({
        where: { reference_no: header.reference_no },
        transaction: t,
      });
      let line_no = 1;
      for (const it of body.items) {
        const asset_code = it.asset_code || it.assetCode || it.assetId;
        const asset = await StoreAsset.findByPk(asset_code, { transaction: t });
        if (!asset) {
          const err = new Error(`Asset not found: ${asset_code}`);
          err.status = 422;
          throw err;
        }
        const book = Number(it.book_balance ?? it.bookBalance ?? 1);
        const physical = Number(it.physical_count ?? it.physicalCount ?? book);
        await PhysicalAssetVerificationItem.create({
          reference_no: header.reference_no,
          line_no,
          asset_code,
          asset_name: asset.name,
          category: asset.category,
          custodian: it.custodian || asset.custodian,
          book_balance: book,
          physical_count: physical,
          variance: physical - book,
          condition: it.condition || asset.physical_condition,
          remarks: it.remarks || null,
        }, { transaction: t });
        line_no += 1;
      }
    }

    if (String(nextStatus).toUpperCase() === "APPROVED") {
      const items = await PhysicalAssetVerificationItem.findAll({
        where: { reference_no: header.reference_no },
        transaction: t,
      });
      for (const it of items) {
        await StoreAsset.update({
          physical_condition: it.condition || undefined,
          verification_status: "Verified",
          last_verification_date: header.verification_date,
        }, { where: { asset_code: it.asset_code }, transaction: t });
      }
    }

    await t.commit();
    const full = await PhysicalAssetVerification.findByPk(header.reference_no, {
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
    });
    res.json({ success: true, data: mapPav(full) });
  } catch (err) {
    await t.rollback();
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

function countBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "Not specified";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Dashboard aggregates for Stock Verification sidebar */
const dashboard = async (req, res, next) => {
  try {
    const [items, movements, assets, pav, prepaid, issued] = await Promise.all([
      StoreInventoryItem.findAll({
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["description"] },
          { model: StateOffice, as: "state", attributes: ["description"] },
        ],
      }),
      StockMovement.findAll({ order: [["movement_date", "DESC"]], limit: 30 }),
      StoreAsset.findAll({
        include: [
          { model: ZonalOffice, as: "zone", attributes: ["description"] },
          { model: StateOffice, as: "state", attributes: ["description"] },
        ],
      }),
      PhysicalAssetVerification.findAll(),
      StockMovement.findAll({ where: { movement_type: "PREPAYMENT", direction: "IN" } }),
      StockMovement.findAll({ where: { movement_type: "ISSUE", direction: "OUT" } }),
    ]);

    const totalQty = items.reduce((s, i) => s + Number(i.quantity_on_hand || 0), 0);
    const lowStock = items.filter((i) => Number(i.quantity_on_hand) <= Number(i.reorder_level || 0));
    const mappedAssets = assets.map(mapAsset);
    const verified = mappedAssets.filter((a) => String(a.verificationStatus).toLowerCase().includes("verif"));
    const tagged = mappedAssets.filter((a) => !!a.nhiaTagNumber);
    const poor = mappedAssets.filter((a) => /poor|defect|damage/i.test(String(a.physicalCondition || "")));
    const unverified = mappedAssets.filter((a) => !String(a.verificationStatus).toLowerCase().includes("verif") || /missing/i.test(String(a.physicalCondition || "")));
    const noCustodian = mappedAssets.filter((a) => !String(a.custodian || "").trim());

    res.json({
      success: true,
      data: {
        inventory: {
          items: items.length,
          quantity_on_hand_total: totalQty,
          low_stock_items: lowStock.length,
          rows: items.map(mapInventory),
        },
        asset_register: {
          total_recorded: mappedAssets.length,
          total_verified: verified.length,
          tagged: tagged.length,
          poor_defective: poor.length,
          unverified_missing: unverified.length,
          no_custodian: noCustodian.length,
          in_store: 0,
          by_category: countBy(mappedAssets, (a) => a.category),
          by_condition: countBy(mappedAssets, (a) => a.physicalCondition || "Unknown"),
          by_zone: countBy(assets, (a) => a.zone?.description),
          by_state: countBy(assets, (a) => a.state?.description).map((r) => ({
            ...r,
            zone: null,
          })),
          rows: mappedAssets,
        },
        prepayment: {
          total: prepaid.length,
          qty_received: prepaid.reduce((s, m) => s + Number(m.qty || 0), 0),
          rows: prepaid.map(mapMovement),
        },
        issuance: {
          total: issued.length,
          qty_issued: issued.reduce((s, m) => s + Number(m.qty || 0), 0),
          rows: issued.map(mapMovement),
        },
        pav_sessions: pav.length,
        recent_movements: movements.map(mapMovement),
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  listInventory,
  getInventory,
  createInventory,
  listItemMovements,
  listPrepayments,
  getPrepayment,
  createPrepayment,
  listIssues,
  createIssue,
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  listPav,
  getPav,
  createPav,
  updatePav,
  dashboard,
};
