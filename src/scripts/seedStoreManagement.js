/**
 * Seed Asset Management (SVO) sample data for every state office store.
 * Idempotent — unique refs (AST-/INV-/SV-/SIV-/CAP-/PAV-/GRN-/MNT-/DSP-) are reused.
 *
 * Covers: Physical Asset Verification, Verification of Supply,
 * Inventory Register, Capitalisation & Issuance.
 *
 *   npm run db:seed-store
 *   node src/scripts/seedStoreManagement.js
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  ZonalOffice,
  StateOffice,
  StoreAsset,
  StoreInventoryItem,
  GoodsReceiptNote,
  StockIssueVoucher,
  SupplyVerification,
  AssetMaintenance,
  AssetDisposal,
  PhysicalAssetVerification,
  PhysicalAssetVerificationItem,
  StockConversion,
} = require("../models");
const { logPartial } = require("../utils/seedUtils");

const isLegacyCode = (code) => /^SO-\d+$/i.test(code || "");

function storeName(stateName) {
  const name = String(stateName || "").trim();
  if (!name) return "State Store";
  if (/\bstore\b/i.test(name)) return name;
  return `${name} Store`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function canonicalStates() {
  const zones = await ZonalOffice.findAll({ attributes: ["id", "zonal_code", "description"] });
  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const states = await StateOffice.findAll({ order: [["description", "ASC"], ["code", "ASC"]] });
  const byDescription = new Map();
  for (const state of states) {
    const key = state.description.trim().toLowerCase();
    const existing = byDescription.get(key);
    if (!existing || (isLegacyCode(existing.code) && !isLegacyCode(state.code))) {
      byDescription.set(key, state);
    }
  }
  return Array.from(byDescription.values()).map((s) => ({
    id: s.id,
    code: s.code,
    description: s.description,
    zone_id: s.zonal_id,
    zone_name: zoneById[s.zonal_id]?.description || null,
    store: storeName(s.description),
  }));
}

async function findOrCreateBy(Model, where, defaults) {
  const existing = await Model.findOne({ where });
  if (existing) return { row: existing, created: false };
  const row = await Model.create({ ...where, ...defaults });
  return { row, created: true };
}

const ASSET_TEMPLATES = [
  { suffix: "01", name: "Executive Office Desk", category: "Office Furniture", sub: "Desks & Workstations", condition: "Good", status: "Active (in-use)", verify: "Verified & Passed", cost: 185000 },
  { suffix: "02", name: "HP LaserJet Printer", category: "Office Equipment", sub: "Printing & Document Management", condition: "Good", status: "Active (in-use)", verify: "Verified & Passed", cost: 240000 },
  { suffix: "03", name: "Split Air Conditioner", category: "Office Equipment", sub: "Office Appliances", condition: "Defective", status: "Under Repair", verify: "Exception", cost: 310000 },
  { suffix: "04", name: "Dell OptiPlex Desktop", category: "Computer Equipment", sub: "User End-Point Devices", condition: "Missing", status: "Missing", verify: "Exception", cost: 420000 },
  { suffix: "05", name: "Metal Filing Cabinet", category: "Office Furniture", sub: "Storage & Filing Systems", condition: "Obsolete", status: "Obsolete", verify: "Verified & Passed", cost: 95000 },
  { suffix: "06", name: "Conference Room Projector", category: "Office Equipment", sub: "Telecommunications", condition: "Retired", status: "Retired", verify: "Verified & Passed", cost: 175000 },
];

const INVENTORY_TEMPLATES = [
  { suffix: "A4", name: "A4 Copy Paper (ream)", category: "Office Consumables", qty: 80, reorder: 20, price: 4500, status: "IN_STOCK" },
  { suffix: "TON", name: "Laser Toner Cartridge", category: "Office Consumables", qty: 6, reorder: 8, price: 28500, status: "LOW_STOCK" },
  { suffix: "PEN", name: "Ballpoint Pen (box)", category: "Office Consumables", qty: 0, reorder: 10, price: 2500, status: "OUT_OF_STOCK" },
  { suffix: "USB", name: "32GB USB Flash Drive", category: "Computer Accessories", qty: 24, reorder: 10, price: 6500, status: "IN_STOCK" },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    try {
      await sequelize.query(
        `ALTER TABLE physical_asset_verification_items
         MODIFY COLUMN \`condition\` ENUM('GOOD','FAIR','POOR','MISSING','DAMAGED','DEFECTIVE','OBSOLETE','RETIRED') NOT NULL DEFAULT 'GOOD'`
      );
    } catch (e) {
      // Table may not exist yet or ENUM already matches — sync/update-store handles schema.
    }

    const stores = await canonicalStates();
    if (!stores.length) {
      console.error("❌  No state offices found. Run npm run db:seed (zones & states) first.");
      process.exit(1);
    }

    let created = 0;
    let skipped = 0;
    const bump = (wasCreated) => {
      if (wasCreated) created += 1;
      else skipped += 1;
    };

    for (const store of stores) {
      const code = store.code;
      const custodian = `${store.description} Store Keeper`;
      const officer = `${store.description} SVO`;

      const assetRows = [];
      for (const t of ASSET_TEMPLATES) {
        const assetNumber = `AST-${code}-${t.suffix}`;
        const { row, created: was } = await findOrCreateBy(
          StoreAsset,
          { assetNumber },
          {
            assetId: assetNumber,
            nhiaTagNumber: `NHIA-${code}-${t.suffix}`,
            name: t.name,
            description: `${t.name} at ${store.store}`,
            category: t.category,
            primaryCategory: t.category,
            subCategory: t.sub,
            officeDeptUnit: store.store,
            facilitySite: store.description,
            location: store.store,
            specificLocation: "Main store",
            assignedCustodian: custodian,
            custodian,
            department: "Store Unit",
            operationalStatus: t.status,
            status: t.condition === "Retired" ? "RETIRED" : t.condition === "Obsolete" ? "OBSOLETE" : "ACTIVE",
            acquisitionDate: todayOffset(400 + Number(t.suffix)),
            acquisitionValue: t.cost,
            acquisitionCost: t.cost,
            usefulLifeYears: 5,
            salvageValue: Math.round(t.cost * 0.1),
            depreciationMethod: "Straight-Line",
            accumulatedDepreciation: Math.round(t.cost * 0.2),
            netBookValue: Math.round(t.cost * 0.8),
            physicalCondition: t.condition,
            lastVerificationDate: t.condition === "Missing" ? null : todayOffset(20),
            verificationStatus: t.verify,
            taggingMethod: "QR Code",
          }
        );
        bump(was);
        assetRows.push(row);
      }

      const invRows = [];
      for (const t of INVENTORY_TEMPLATES) {
        const itemCode = `INV-${code}-${t.suffix}`;
        const { row, created: was } = await findOrCreateBy(
          StoreInventoryItem,
          { itemCode },
          {
            name: t.name,
            category: t.category,
            unitOfMeasure: "Units",
            quantityInStock: t.qty,
            reorderLevel: t.reorder,
            unitPrice: t.price,
            storeLocation: store.store,
            status: t.status,
          }
        );
        bump(was);
        invRows.push(row);
      }

      const paper = invRows[0];
      const toner = invRows[1];

      const { created: grnCreated } = await findOrCreateBy(
        GoodsReceiptNote,
        { grnNumber: `GRN-${code}-01` },
        {
          supplierName: "NHIA Approved Stationery Ltd",
          poNumber: `PO-${code}-2026-01`,
          receivedDate: todayOffset(45),
          totalItems: 2,
          receivedBy: officer,
          status: "VERIFIED",
          remarks: `Receipt into ${store.store}`,
        }
      );
      bump(grnCreated);

      const { created: svPass } = await findOrCreateBy(
        SupplyVerification,
        { supplyRefNo: `SV-${code}-01` },
        {
          certificateDate: todayOffset(40),
          goodsCategory: "Office Equipment",
          storeSubcategory: "Office Consumables",
          supplyNature: "Goods",
          storeLocation: store.store,
          procurementInstrument: "LPO",
          procurementDate: todayOffset(55),
          supplierName: "NHIA Approved Stationery Ltd",
          contractorAddress: `${store.description}, Nigeria`,
          purchaseOrderRef: `PO-${code}-2026-01`,
          srvNo: `SRV-${code}-01`,
          srvDate: todayOffset(42),
          expectedItemName: "A4 Copy Paper (ream)",
          suppliedItemName: "A4 Copy Paper (ream)",
          expectedQuantity: 80,
          suppliedQuantity: 80,
          specificationMatch: true,
          priceConformance: true,
          physicalCondition: "GOOD",
          verdict: "VERIFIED_PASSED",
          classification: "STORE_INVENTORY",
          zone_id: store.zone_id,
          state_id: store.id,
          zone_name: store.zone_name,
          state_name: store.description,
          department_name: "Store Unit",
          lineItems: [
            { description: "A4 Copy Paper (ream)", quantityDelivered: 80, unitPrice: 4500 },
            { description: "Laser Toner Cartridge", quantityDelivered: 6, unitPrice: 28500 },
          ],
          verifiedBy: officer,
          officerDesignation: "Stock Verification Officer",
          signOffDate: todayOffset(40),
          approvalStatus: "APPROVED",
          remarks: `Supply verified into ${store.store}`,
        }
      );
      bump(svPass);

      const { created: svFail } = await findOrCreateBy(
        SupplyVerification,
        { supplyRefNo: `SV-${code}-02` },
        {
          certificateDate: todayOffset(12),
          goodsCategory: "Computer Equipment",
          storeSubcategory: "Accessories",
          supplyNature: "Goods",
          storeLocation: store.store,
          procurementInstrument: "LPO",
          procurementDate: todayOffset(18),
          supplierName: "Northern ICT Supplies",
          contractorAddress: `${store.description}, Nigeria`,
          purchaseOrderRef: `PO-${code}-2026-02`,
          srvNo: `SRV-${code}-02`,
          srvDate: todayOffset(13),
          expectedItemName: "32GB USB Flash Drive",
          suppliedItemName: "16GB USB Flash Drive",
          expectedQuantity: 24,
          suppliedQuantity: 20,
          specificationMatch: false,
          priceConformance: true,
          physicalCondition: "FAIR",
          verdict: "FAILED",
          classification: "STORE_INVENTORY",
          zone_id: store.zone_id,
          state_id: store.id,
          zone_name: store.zone_name,
          state_name: store.description,
          department_name: "Store Unit",
          lineItems: [{ description: "USB Flash Drive", quantityDelivered: 20, unitPrice: 6500 }],
          verifiedBy: officer,
          officerDesignation: "Stock Verification Officer",
          signOffDate: todayOffset(12),
          approvalStatus: "PENDING",
          remarks: "Specification mismatch — held pending replacement",
        }
      );
      bump(svFail);

      const { created: issueCreated } = await findOrCreateBy(
        StockIssueVoucher,
        { issueNumber: `SIV-${code}-01` },
        {
          department: "Administration",
          recipientName: `${store.description} Admin Officer`,
          issueDate: todayOffset(8),
          issuedBy: officer,
          status: "DISPATCHED",
          remarks: `Issue from ${store.store}`,
          fromLocation: store.store,
          toLocation: `${store.description} Admin`,
          lineItems: paper
            ? [{ itemId: paper.id, itemCode: paper.itemCode, name: paper.name, quantity: 10, unitPrice: paper.unitPrice }]
            : [],
        }
      );
      bump(issueCreated);

      const capitalAsset = assetRows[1];
      const { created: capCreated } = await findOrCreateBy(
        StockConversion,
        { conversionRef: `CAP-${code}-01` },
        {
          inventoryItemId: toner?.id || 0,
          itemCode: toner?.itemCode || `INV-${code}-TON`,
          itemName: toner?.name || "Laser Toner Cartridge",
          quantity: 1,
          storeLocation: store.store,
          assetId: capitalAsset?.id || null,
          assetNumber: capitalAsset?.assetNumber || `AST-${code}-02`,
          convertedBy: officer,
          conversionDate: todayOffset(30),
          remarks: `Capitalised from ${store.store} inventory`,
        }
      );
      bump(capCreated);

      const pavRef = `PAV-${code}-01`;
      const { row: pav, created: pavCreated } = await findOrCreateBy(
        PhysicalAssetVerification,
        { referenceNo: pavRef },
        {
          stocktakingType: "periodic",
          verificationDate: todayOffset(20),
          zone_id: store.zone_id,
          state_id: store.id,
          zone_name: store.zone_name,
          state_name: store.description,
          department_name: "Store Unit",
          storeKeeper: custodian,
          auditOfficer: officer,
          status: "SUBMITTED",
          remarks: `Periodic count — ${store.store}`,
          createdBy: officer,
        }
      );
      bump(pavCreated);

      if (pavCreated) {
        const condMap = {
          Good: "GOOD",
          Defective: "DEFECTIVE",
          Missing: "MISSING",
          Obsolete: "OBSOLETE",
          Retired: "RETIRED",
        };
        await PhysicalAssetVerificationItem.bulkCreate(
          assetRows.map((a, i) => {
            const cond = condMap[ASSET_TEMPLATES[i].condition] || "GOOD";
            const physical = cond === "MISSING" ? 0 : 1;
            return {
              verification_id: pav.id,
              assetId: a.id,
              assetNumber: a.assetNumber,
              assetName: a.name,
              category: a.primaryCategory,
              custodian,
              bookBalance: 1,
              physicalCount: physical,
              variance: 1 - physical,
              condition: cond,
              remarks: cond === "MISSING" ? "Not found on floor" : null,
            };
          })
        );
        created += assetRows.length;
      } else {
        skipped += assetRows.length;
      }

      const ac = assetRows[2];
      if (ac) {
        const { created: mntCreated } = await findOrCreateBy(
          AssetMaintenance,
          { maintenanceNo: `MNT-${code}-01` },
          {
            assetId: ac.id,
            assetNumber: ac.assetNumber,
            assetName: ac.name,
            type: "CORRECTIVE",
            description: "Compressor fault — under repair",
            vendor: "CoolTech Services",
            cost: 45000,
            startDate: todayOffset(10),
            completionDate: null,
            performedBy: officer,
          }
        );
        bump(mntCreated);
      }

      const obsolete = assetRows[4];
      if (obsolete) {
        const { created: dspCreated } = await findOrCreateBy(
          AssetDisposal,
          { disposalNumber: `DSP-${code}-01` },
          {
            assetId: obsolete.id,
            assetNumber: obsolete.assetNumber,
            assetName: obsolete.name,
            reason: "OBSOLETE",
            approvedBy: officer,
            disposalValue: 15000,
            disposalDate: todayOffset(5),
            remarks: `Board write-off from ${store.store}`,
          }
        );
        bump(dspCreated);
      }
    }

    logPartial(`Asset Management seed (${stores.length} stores)`, created, skipped);
    console.log("\n    Physical assets, inventory, supply certificates,");
    console.log("    issues, capitalisations, verifications, maintenance, disposals.\n");
    process.exit(0);
  } catch (err) {
    console.error("❌  Store seed failed:", err.message || err);
    process.exit(1);
  }
})();
