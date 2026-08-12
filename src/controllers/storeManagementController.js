const {
  StoreAsset,
  StoreInventoryItem,
  GoodsReceiptNote,
  StockIssueVoucher,
  AssetTransfer,
  SupplyVerification,
  AssetMaintenance,
  AssetDisposal,
  PhysicalAssetVerification,
  PhysicalAssetVerificationItem,
  StockConversion,
  ZonalOffice,
  StateOffice,
  Department,
  Unit,
} = require("../models");

async function resolveLocationNames(record) {
  const data = record.toJSON ? record.toJSON() : { ...record };
  try {
    if (data.zone_id && !data.zone_name) {
      const z = await ZonalOffice.findByPk(data.zone_id);
      data.zone_name = z?.description || z?.name || null;
    }
    if (data.state_id && !data.state_name) {
      const s = await StateOffice.findByPk(data.state_id);
      data.state_name = s?.description || s?.name || null;
    }
    if (data.department_id && !data.department_name) {
      const d = await Department.findByPk(data.department_id);
      data.department_name = d?.name || d?.description || null;
    }
    if (data.unit_id && !data.unit_name) {
      const u = await Unit.findByPk(data.unit_id);
      data.unit_name = u?.name || u?.description || null;
    }
  } catch {
    // keep IDs if lookup fails
  }
  return data;
}

// ─── Assets ───────────────────────────────────────────────────────────────────
exports.getAssets = async (req, res) => {
  try {
    const assets = await StoreAsset.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: assets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAssetById = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await StoreAsset.findOne({
      where: {
        [require("sequelize").Op.or]: [{ id }, { assetNumber: id }, { assetId: id }],
      },
    });
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const count = await StoreAsset.count();
    const nextSeq = String(count + 1).padStart(4, "0");
    const year = new Date().getFullYear();

    const assetId = req.body.assetId || req.body.nhiaTagNumber || `NHIA/AST/${year}/${nextSeq}`;
    const assetNumber = req.body.assetNumber || assetId;
    const controlNumber = req.body.controlNumber || `CTRL-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    const barcodeQrCode = req.body.barcodeQrCode || `QR-NHIA-${Date.now().toString().slice(-6)}`;

    const asset = await StoreAsset.create({
      ...req.body,
      assetId,
      assetNumber,
      controlNumber,
      barcodeQrCode,
      created_by: req.user?.id || null,
    });
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await StoreAsset.update(req.body, { where: { id } });
    if (!updated) return res.status(404).json({ success: false, message: "Asset not found" });
    const asset = await StoreAsset.findByPk(id);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await StoreAsset.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ success: false, message: "Asset not found" });
    res.json({ success: true, message: "Asset deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Inventory Items ──────────────────────────────────────────────────────────
exports.getInventoryItems = async (req, res) => {
  try {
    const items = await StoreInventoryItem.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getInventoryItemById = async (req, res) => {
  try {
    const item = await StoreInventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createInventoryItem = async (req, res) => {
  try {
    const item = await StoreInventoryItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Goods Receipt Notes (GRN) ────────────────────────────────────────────────
exports.getGoodsReceipts = async (req, res) => {
  try {
    const receipts = await GoodsReceiptNote.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: receipts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createGoodsReceipt = async (req, res) => {
  try {
    const receipt = await GoodsReceiptNote.create({
      ...req.body,
      receivedBy: req.user?.name || req.body.receivedBy || "Store Officer",
    });
    res.status(201).json({ success: true, data: receipt });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Stock Issue Vouchers ─────────────────────────────────────────────────────
exports.getStockIssues = async (req, res) => {
  try {
    const issues = await StockIssueVoucher.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createStockIssue = async (req, res) => {
  try {
    const lines = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    for (const line of lines) {
      const qty = Number(line.quantity || 0);
      if (!line.inventoryItemId || qty <= 0) continue;
      const item = await StoreInventoryItem.findByPk(line.inventoryItemId);
      if (!item) {
        return res.status(400).json({ success: false, error: `Inventory item not found (${line.inventoryItemId})` });
      }
      const onHand = Number(item.quantityInStock || 0);
      if (qty > onHand) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${item.name || item.itemCode}: ${onHand} on hand, requested ${qty}`,
        });
      }
    }

    const issue = await StockIssueVoucher.create({
      ...req.body,
      issuedBy: req.user?.name || req.body.issuedBy || "Store Officer",
      status: req.body.status || "APPROVED",
      toLocation: req.body.toLocation || req.body.department || null,
      lineItems: lines,
    });

    for (const line of lines) {
      const qty = Number(line.quantity || 0);
      if (!line.inventoryItemId || qty <= 0) continue;
      const item = await StoreInventoryItem.findByPk(line.inventoryItemId);
      if (!item) continue;
      const remaining = Math.max(0, Number(item.quantityInStock || 0) - qty);
      const reorder = Number(item.reorderLevel || 10);
      const status = remaining <= 0 ? "OUT_OF_STOCK" : remaining <= reorder ? "LOW_STOCK" : "IN_STOCK";
      await item.update({ quantityInStock: remaining, status });
    }

    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Capitalisation (store stock → tagged asset) ──────────────────────────────
exports.getConversions = async (req, res) => {
  try {
    const rows = await StockConversion.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.capitaliseInventory = async (req, res) => {
  const t = await StoreAsset.sequelize.transaction();
  try {
    const qty = Math.max(1, Number(req.body.quantity || 1));
    const inventoryItemId = req.body.inventoryItemId;
    if (!inventoryItemId) {
      await t.rollback();
      return res.status(400).json({ success: false, error: "inventoryItemId is required" });
    }

    const item = await StoreInventoryItem.findByPk(inventoryItemId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    const onHand = Number(item.quantityInStock || 0);
    if (qty > onHand) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: `Insufficient stock for ${item.name}: ${onHand} on hand, requested ${qty}`,
      });
    }

    const year = new Date().getFullYear();
    const nextSeq = String((await StoreAsset.count({ transaction: t })) + 1).padStart(4, "0");
    const assetBody = req.body.asset || {};
    const assetId = assetBody.assetId || assetBody.nhiaTagNumber || `NHIA/AST/${year}/${nextSeq}`;
    const assetNumber = assetBody.assetNumber || assetId;

    const asset = await StoreAsset.create({
      ...assetBody,
      name: assetBody.name || item.name,
      primaryCategory: assetBody.primaryCategory || item.category,
      acquisitionCost: assetBody.acquisitionCost || item.unitPrice,
      assetId,
      assetNumber,
      controlNumber: assetBody.controlNumber || `CTRL-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
      barcodeQrCode: assetBody.barcodeQrCode || `QR-NHIA-${Date.now().toString().slice(-6)}`,
      created_by: req.user?.id || null,
    }, { transaction: t });

    const remaining = Math.max(0, onHand - qty);
    const reorder = Number(item.reorderLevel || 10);
    const status = remaining <= 0 ? "OUT_OF_STOCK" : remaining <= reorder ? "LOW_STOCK" : "IN_STOCK";
    await item.update({ quantityInStock: remaining, status }, { transaction: t });

    const convCount = await StockConversion.count({ transaction: t });
    const conversion = await StockConversion.create({
      conversionRef: req.body.conversionRef || `CONV-${year}-${String(convCount + 1).padStart(4, "0")}`,
      inventoryItemId: item.id,
      itemCode: item.itemCode,
      itemName: item.name,
      quantity: qty,
      storeLocation: item.storeLocation,
      assetId: asset.id,
      assetNumber: asset.assetNumber || asset.assetId,
      convertedBy: req.user?.name || req.body.convertedBy || "Store Officer",
      conversionDate: req.body.conversionDate || new Date().toISOString().slice(0, 10),
      remarks: req.body.remarks || null,
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ success: true, data: { asset, conversion, item } });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getInventoryMovements = async (req, res) => {
  try {
    const item = await StoreInventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    const movements = [];
    const name = String(item.name || "").trim().toLowerCase();
    const code = String(item.itemCode || "").trim().toLowerCase();

    const supplies = await SupplyVerification.findAll({ order: [["id", "ASC"]] });
    for (const sv of supplies) {
      const lines = Array.isArray(sv.lineItems) ? sv.lineItems : [];
      const matched = lines.filter((l) => {
        const desc = String(l.description || "").trim().toLowerCase();
        return desc && (desc === name || desc.includes(name) || name.includes(desc));
      });
      const qty = matched.reduce((s, l) => s + Number(l.quantityDelivered || 0), 0);
      const storeOk = !item.storeLocation || !sv.storeLocation
        || String(sv.storeLocation).toLowerCase() === String(item.storeLocation).toLowerCase();
      if (qty > 0 && storeOk) {
        movements.push({
          date: sv.certificateDate || sv.created_at,
          type: "Receipt",
          ref: sv.supplyRefNo,
          qtyIn: qty,
          qtyOut: 0,
          officer: sv.verifiedBy,
        });
      }
    }

    const issues = await StockIssueVoucher.findAll({ order: [["id", "ASC"]] });
    for (const iss of issues) {
      const lines = Array.isArray(iss.lineItems) ? iss.lineItems : [];
      const matched = lines.filter((l) => {
        if (Number(l.inventoryItemId) === Number(item.id)) return true;
        const n = String(l.name || "").trim().toLowerCase();
        const c = String(l.itemCode || "").trim().toLowerCase();
        return (n && n === name) || (c && c === code);
      });
      const qty = matched.reduce((s, l) => s + Number(l.quantity || 0), 0);
      if (qty > 0) {
        movements.push({
          date: iss.issueDate || iss.created_at,
          type: "Issue",
          ref: iss.issueNumber,
          qtyIn: 0,
          qtyOut: qty,
          officer: iss.issuedBy,
        });
      }
    }

    const conversions = await StockConversion.findAll({
      where: { inventoryItemId: item.id },
      order: [["id", "ASC"]],
    });
    for (const conv of conversions) {
      movements.push({
        date: conv.conversionDate || conv.created_at,
        type: "Capitalisation",
        ref: conv.conversionRef,
        qtyIn: 0,
        qtyOut: Number(conv.quantity || 0),
        officer: conv.convertedBy,
        note: conv.assetNumber,
      });
    }

    movements.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let balance = 0;
    const withBalance = movements.map((m) => {
      balance += Number(m.qtyIn || 0) - Number(m.qtyOut || 0);
      return { ...m, balance };
    });

    res.json({ success: true, data: withBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Transfers ────────────────────────────────────────────────────────────────
exports.getTransfers = async (req, res) => {
  try {
    const transfers = await AssetTransfer.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: transfers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createTransfer = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const count = await AssetTransfer.count();
    const transferNumber =
      req.body.transferNumber || `TRF-${year}-${String(count + 1).padStart(4, "0")}`;

    let assetId = req.body.assetId;
    let assetNumber = req.body.assetNumber || "";
    let assetName = req.body.assetName || "";

    if (!assetId && (assetNumber || req.body.assetTag)) {
      const tag = assetNumber || req.body.assetTag;
      const asset = await StoreAsset.findOne({
        where: {
          [require("sequelize").Op.or]: [
            { assetId: tag },
            { assetNumber: tag },
            { nhiaTagNumber: tag },
          ],
        },
      });
      if (asset) {
        assetId = asset.id;
        assetNumber = asset.assetId || asset.assetNumber || tag;
        assetName = asset.name || assetName;
      }
    }

    if (!assetId) {
      return res.status(400).json({ success: false, error: "Valid asset is required" });
    }

    const transfer = await AssetTransfer.create({
      ...req.body,
      transferNumber,
      assetId,
      assetNumber,
      assetName,
      status: req.body.status || "SUBMITTED",
      requestedBy: req.user?.name || req.body.requestedBy || "Officer",
    });
    res.status(201).json({ success: true, data: transfer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await AssetTransfer.update(req.body, { where: { id } });
    if (!updated) return res.status(404).json({ success: false, message: "Transfer request not found" });
    const transfer = await AssetTransfer.findByPk(id);
    res.json({ success: true, data: transfer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Supply Verifications ─────────────────────────────────────────────────────
exports.getSupplyVerifications = async (req, res) => {
  try {
    const verifications = await SupplyVerification.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: verifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSupplyVerificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await SupplyVerification.findOne({
      where: {
        [require("sequelize").Op.or]: [
          { id },
          { supplyRefNo: id },
        ],
      },
    });
    if (!record) {
      return res.status(404).json({ success: false, message: "Supply verification not found" });
    }
    const data = await resolveLocationNames(record);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createSupplyVerification = async (req, res) => {
  try {
    const body = { ...req.body };

    // Normalize physical condition to ENUM values
    if (body.physicalCondition) {
      body.physicalCondition = String(body.physicalCondition)
        .toUpperCase()
        .replace(/\s+/g, "_");
      const map = {
        EXCELLENT: "EXCELLENT",
        GOOD: "GOOD",
        FAIR: "FAIR",
        POOR: "POOR",
        DEFECTIVE: "DEFECTIVE",
      };
      body.physicalCondition = map[body.physicalCondition] || "GOOD";
    }

    // Derive legacy single-item columns from first line item when present
    const lines = Array.isArray(body.lineItems) ? body.lineItems : [];
    if (lines.length > 0) {
      const first = lines[0];
      body.expectedItemName = body.expectedItemName || first.description || "Item";
      body.suppliedItemName = body.suppliedItemName || first.description || "Item";
      body.suppliedQuantity = body.suppliedQuantity ?? (Number(first.quantityDelivered) || 1);
      body.expectedQuantity = body.expectedQuantity ?? body.suppliedQuantity;
    }

    if (!body.supplierName && body.contractorName) {
      body.supplierName = body.contractorName;
    }

    const verification = await SupplyVerification.create({
      ...body,
      verifiedBy: req.user?.name || body.verifiedBy || "Inspector",
    });

    // STORE_INVENTORY → post line items into Inventory Catalog (no separate GRN step)
    const inventoryPosted = [];
    if (body.classification === "STORE_INVENTORY" && lines.length > 0) {
      const category = body.storeSubcategory || body.goodsCategory || "Office Consumables";
      for (const line of lines) {
        const name = String(line.description || "").trim();
        if (!name) continue;
        const qty = Math.max(0, Number(line.quantityDelivered) || 0);
        const unitPrice = Number(line.unitPrice) || 0;

        const storeLocation = body.storeLocation || "HQ Main Depot Store";
        let item = await StoreInventoryItem.findOne({ where: { name, category, storeLocation } });
        if (item) {
          const newQty = (item.quantityInStock || 0) + qty;
          const status =
            newQty <= 0 ? "OUT_OF_STOCK" : newQty <= (item.reorderLevel || 10) ? "LOW_STOCK" : "IN_STOCK";
          await item.update({
            quantityInStock: newQty,
            unitPrice: unitPrice || item.unitPrice,
            status,
            storeLocation,
          });
          inventoryPosted.push(item);
        } else {
          const year = new Date().getFullYear();
          const seq = String((await StoreInventoryItem.count()) + 1).padStart(4, "0");
          item = await StoreInventoryItem.create({
            itemCode: `INV-${year}-${seq}`,
            name,
            category,
            unitOfMeasure: "Units",
            quantityInStock: qty,
            unitPrice,
            reorderLevel: 10,
            storeLocation,
            status: qty <= 0 ? "OUT_OF_STOCK" : qty <= 10 ? "LOW_STOCK" : "IN_STOCK",
          });
          inventoryPosted.push(item);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: verification,
      inventoryPosted: inventoryPosted.map((i) => i.toJSON()),
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Maintenance & Disposal ───────────────────────────────────────────────────
exports.getMaintenance = async (req, res) => {
  try {
    const records = await AssetMaintenance.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createMaintenance = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const count = await AssetMaintenance.count();
    const maintenanceNo =
      req.body.maintenanceNo || `MNT-${year}-${String(count + 1).padStart(4, "0")}`;

    let assetId = req.body.assetId;
    let assetNumber = req.body.assetNumber || "";
    let assetName = req.body.assetName || "";
    if (!assetId && assetNumber) {
      const asset = await StoreAsset.findOne({
        where: {
          [require("sequelize").Op.or]: [
            { assetId: assetNumber },
            { assetNumber },
            { nhiaTagNumber: assetNumber },
          ],
        },
      });
      if (asset) {
        assetId = asset.id;
        assetNumber = asset.assetId || asset.assetNumber || assetNumber;
        assetName = asset.name || assetName;
      }
    }
    if (!assetId) {
      return res.status(400).json({ success: false, error: "Valid asset is required" });
    }

    const record = await AssetMaintenance.create({
      ...req.body,
      maintenanceNo,
      assetId,
      assetNumber,
      assetName,
      performedBy: req.user?.name || req.body.performedBy || "Technician",
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getDisposals = async (req, res) => {
  try {
    const records = await AssetDisposal.findAll({ order: [["id", "DESC"]] });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createDisposal = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const count = await AssetDisposal.count();
    const disposalNumber =
      req.body.disposalNumber || `DSP-${year}-${String(count + 1).padStart(4, "0")}`;

    let assetId = req.body.assetId;
    let assetNumber = req.body.assetNumber || "";
    let assetName = req.body.assetName || "";
    if (!assetId && assetNumber) {
      const asset = await StoreAsset.findOne({
        where: {
          [require("sequelize").Op.or]: [
            { assetId: assetNumber },
            { assetNumber },
            { nhiaTagNumber: assetNumber },
          ],
        },
      });
      if (asset) {
        assetId = asset.id;
        assetNumber = asset.assetId || asset.assetNumber || assetNumber;
        assetName = asset.name || assetName;
      }
    }
    if (!assetId) {
      return res.status(400).json({ success: false, error: "Valid asset is required" });
    }

    const record = await AssetDisposal.create({
      ...req.body,
      disposalNumber,
      assetId,
      assetNumber,
      assetName,
      approvedBy: req.user?.name || req.body.approvedBy || "Board",
      disposalDate: req.body.disposalDate || new Date().toISOString().slice(0, 10),
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Physical Asset Verification (audit of Master Register) ───────────────────
async function nextPhysicalRef() {
  const year = new Date().getFullYear();
  const count = await PhysicalAssetVerification.count();
  return `PAV-${year}-${String(count + 1).padStart(4, "0")}`;
}

function mapPhysicalCondition(raw) {
  const u = String(raw || "GOOD").toUpperCase();
  const labels = {
    GOOD: "Good",
    FAIR: "Fair",
    POOR: "Poor",
    DAMAGED: "Damaged",
    DEFECTIVE: "Defective",
    MISSING: "Missing",
    OBSOLETE: "Obsolete",
    RETIRED: "Retired",
    EXCELLENT: "Good",
  };
  return labels[u] || "Good";
}

function mapPhysicalItems(verificationId, items = []) {
  const allowed = new Set(["GOOD", "FAIR", "POOR", "MISSING", "DAMAGED", "DEFECTIVE", "OBSOLETE", "RETIRED"]);
  return (items || [])
    .filter((item) => item.assetName || item.assetNumber)
    .map((item) => {
      const book = Number(item.bookBalance ?? 1) || 0;
      const physical = Number(item.physicalCount ?? 0) || 0;
      let condition = String(item.condition || "GOOD").toUpperCase();
      if (condition === "EXCELLENT") condition = "GOOD";
      if (!allowed.has(condition)) condition = "GOOD";
      return {
        verification_id: verificationId,
        assetId: item.assetId || null,
        assetNumber: item.assetNumber || null,
        assetName: item.assetName || "Asset",
        category: item.category || null,
        custodian: item.custodian || null,
        bookBalance: book,
        physicalCount: physical,
        variance: book - physical,
        condition,
        remarks: item.remarks || null,
      };
    });
}

exports.getPhysicalVerifications = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (req.query.type) where.stocktakingType = req.query.type;
    const list = await PhysicalAssetVerification.findAll({
      where,
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
      order: [["id", "DESC"]],
    });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getPhysicalVerificationById = async (req, res) => {
  try {
    const record = await PhysicalAssetVerification.findOne({
      where: {
        [require("sequelize").Op.or]: [
          { id: req.params.id },
          { referenceNo: req.params.id },
        ],
      },
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
    });
    if (!record) {
      return res.status(404).json({ success: false, message: "Physical verification not found" });
    }
    const data = await resolveLocationNames(record);
    data.items = record.items || [];
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createPhysicalVerification = async (req, res) => {
  try {
    const body = { ...req.body };
    const referenceNo = body.referenceNo || (await nextPhysicalRef());
    const status = String(body.status || "DRAFT").toUpperCase();
    const header = await PhysicalAssetVerification.create({
      referenceNo,
      stocktakingType: body.stocktakingType || "periodic",
      verificationDate: body.verificationDate || new Date().toISOString().slice(0, 10),
      zone_id: body.zone_id || null,
      state_id: body.state_id || null,
      department_id: body.department_id || null,
      unit_id: body.unit_id || null,
      zone_name: body.zone_name || null,
      state_name: body.state_name || null,
      department_name: body.department_name || null,
      unit_name: body.unit_name || null,
      storeKeeper: body.storeKeeper || null,
      auditOfficer: body.auditOfficer || null,
      status,
      remarks: body.remarks || null,
      createdBy: req.user?.name || body.createdBy || "Officer",
    });

    const rows = mapPhysicalItems(header.id, body.items);
    if (rows.length) await PhysicalAssetVerificationItem.bulkCreate(rows);

    if (status === "SUBMITTED" || status === "APPROVED") {
      for (const row of rows) {
        if (!row.assetId) continue;
        await StoreAsset.update(
          {
            lastVerificationDate: header.verificationDate,
            verificationStatus:
              row.variance === 0 && row.condition !== "MISSING"
                ? "Verified & Passed"
                : "Exception",
            physicalCondition: mapPhysicalCondition(row.condition),
          },
          { where: { id: row.assetId } }
        );
      }
    }

    const full = await PhysicalAssetVerification.findByPk(header.id, {
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
    });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updatePhysicalVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await PhysicalAssetVerification.findByPk(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Physical verification not found" });
    }

    const body = { ...req.body };
    if (body.status) body.status = String(body.status).toUpperCase();

    await existing.update({
      stocktakingType: body.stocktakingType ?? existing.stocktakingType,
      verificationDate: body.verificationDate ?? existing.verificationDate,
      zone_id: body.zone_id ?? existing.zone_id,
      state_id: body.state_id ?? existing.state_id,
      department_id: body.department_id ?? existing.department_id,
      unit_id: body.unit_id ?? existing.unit_id,
      zone_name: body.zone_name ?? existing.zone_name,
      state_name: body.state_name ?? existing.state_name,
      department_name: body.department_name ?? existing.department_name,
      unit_name: body.unit_name ?? existing.unit_name,
      storeKeeper: body.storeKeeper ?? existing.storeKeeper,
      auditOfficer: body.auditOfficer ?? existing.auditOfficer,
      status: body.status ?? existing.status,
      remarks: body.remarks ?? existing.remarks,
    });

    if (Array.isArray(body.items)) {
      await PhysicalAssetVerificationItem.destroy({ where: { verification_id: id } });
      const rows = mapPhysicalItems(id, body.items);
      if (rows.length) await PhysicalAssetVerificationItem.bulkCreate(rows);
    }

    const status = body.status || existing.status;
    if (status === "SUBMITTED" || status === "APPROVED") {
      const items = await PhysicalAssetVerificationItem.findAll({ where: { verification_id: id } });
      for (const row of items) {
        if (!row.assetId) continue;
        await StoreAsset.update(
          {
            lastVerificationDate: existing.verificationDate,
            verificationStatus:
              row.variance === 0 && row.condition !== "MISSING"
                ? "Verified & Passed"
                : "Exception",
            physicalCondition: mapPhysicalCondition(row.condition),
          },
          { where: { id: row.assetId } }
        );
      }
    }

    const full = await PhysicalAssetVerification.findByPk(id, {
      include: [{ model: PhysicalAssetVerificationItem, as: "items" }],
    });
    res.json({ success: true, data: full });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
