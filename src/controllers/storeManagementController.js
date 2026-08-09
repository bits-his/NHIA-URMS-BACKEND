const {
  StoreAsset,
  StoreInventoryItem,
  GoodsReceiptNote,
  StockIssueVoucher,
  AssetTransfer,
  SupplyVerification,
  AssetMaintenance,
  AssetDisposal,
} = require("../models");

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
    const issue = await StockIssueVoucher.create({
      ...req.body,
      issuedBy: req.user?.name || req.body.issuedBy || "Store Officer",
    });
    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
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
    res.json({ success: true, data: record });
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

        let item = await StoreInventoryItem.findOne({ where: { name, category } });
        if (item) {
          const newQty = (item.quantityInStock || 0) + qty;
          const status =
            newQty <= 0 ? "OUT_OF_STOCK" : newQty <= (item.reorderLevel || 10) ? "LOW_STOCK" : "IN_STOCK";
          await item.update({
            quantityInStock: newQty,
            unitPrice: unitPrice || item.unitPrice,
            status,
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
            storeLocation: "Main Depot",
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
