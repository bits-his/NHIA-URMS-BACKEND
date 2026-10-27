/**
 * Seed demo inventory, movements (prepayment/issue), assets, and one PAV session.
 *   node src/scripts/seedStorePackDemo.js
 *   npm run db:seed-store-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  StoreInventoryItem,
  StockMovement,
  StoreAsset,
  PhysicalAssetVerification,
  PhysicalAssetVerificationItem,
  StateOffice,
} = require("../models");

async function main() {
  await sequelize.authenticate();
  console.log("Syncing store-management tables…");
  await syncActiveSchema({ alter: true });

  const states = await StateOffice.findAll({ limit: 6 });
  if (!states.length) throw new Error("No state_offices — seed zones/states first");

  // Clean demo rows
  await PhysicalAssetVerificationItem.destroy({ where: { reference_no: { [Op.like]: "PAV-DEMO-%" } } });
  await PhysicalAssetVerification.destroy({ where: { reference_no: { [Op.like]: "PAV-DEMO-%" } } });
  await StockMovement.destroy({
    where: {
      [Op.or]: [
        { movement_code: { [Op.like]: "PAR-DEMO-%" } },
        { movement_code: { [Op.like]: "SIV-DEMO-%" } },
      ],
    },
  });
  await StoreAsset.destroy({ where: { asset_code: { [Op.like]: "AST-DEMO-%" } } });
  await StoreInventoryItem.destroy({ where: { item_code: { [Op.like]: "ITEM-DEMO-%" } } });

  const items = [
    { item_code: "ITEM-DEMO-00001", name: "A4 Copy Paper (Ream)", category: "Stationery", uom: "Ream", unit_price: 3500 },
    { item_code: "ITEM-DEMO-00002", name: "Ballpoint Pen (Box)", category: "Stationery", uom: "Box", unit_price: 1200 },
    { item_code: "ITEM-DEMO-00003", name: "Toner Cartridge HP", category: "Consumables", uom: "Unit", unit_price: 45000 },
    { item_code: "ITEM-DEMO-00004", name: "Face Mask (Pack)", category: "Medical", uom: "Pack", unit_price: 2500 },
  ];

  for (let i = 0; i < items.length; i += 1) {
    const st = states[i % states.length];
    await StoreInventoryItem.create({
      ...items[i],
      quantity_on_hand: 0,
      reorder_level: 5,
      store_location: "Main Store",
      status: "ACTIVE",
      zonal_code: st.zonal_code,
      state_code: st.code,
    });
  }

  // Prepayment IN
  const prepay = [
    { code: "PAR-DEMO-00001", item: "ITEM-DEMO-00001", qty: 40, contractor: "Office Supplies Ltd" },
    { code: "PAR-DEMO-00002", item: "ITEM-DEMO-00002", qty: 25, contractor: "Stationery Hub" },
    { code: "PAR-DEMO-00003", item: "ITEM-DEMO-00003", qty: 8, contractor: "IT Consumables Co" },
    { code: "PAR-DEMO-00004", item: "ITEM-DEMO-00004", qty: 30, contractor: "MediPack Nigeria" },
  ];
  for (const p of prepay) {
    const item = await StoreInventoryItem.findByPk(p.item);
    await StockMovement.create({
      movement_code: p.code,
      item_code: p.item,
      direction: "IN",
      movement_type: "PREPAYMENT",
      qty: p.qty,
      movement_date: "2026-09-15",
      reference_doc: p.code,
      supplier_or_contractor: p.contractor,
      unit_price: item.unit_price,
      status: "POSTED",
      zonal_code: item.zonal_code,
      state_code: item.state_code,
    });
    await item.update({ quantity_on_hand: Number(item.quantity_on_hand) + p.qty });
  }

  // Issue OUT
  const issues = [
    { code: "SIV-DEMO-00001", item: "ITEM-DEMO-00001", qty: 10, recipient: "Amina Yusuf" },
    { code: "SIV-DEMO-00002", item: "ITEM-DEMO-00002", qty: 5, recipient: "Chinedu Okeke" },
    { code: "SIV-DEMO-00003", item: "ITEM-DEMO-00004", qty: 8, recipient: "Clinic Desk" },
  ];
  for (const iss of issues) {
    const item = await StoreInventoryItem.findByPk(iss.item);
    await StockMovement.create({
      movement_code: iss.code,
      item_code: iss.item,
      direction: "OUT",
      movement_type: "ISSUE",
      qty: iss.qty,
      movement_date: "2026-10-05",
      recipient_name: iss.recipient,
      status: "POSTED",
      zonal_code: item.zonal_code,
      state_code: item.state_code,
    });
    await item.update({ quantity_on_hand: Number(item.quantity_on_hand) - iss.qty });
  }

  // Assets
  const assets = [
    { asset_code: "AST-DEMO-00001", name: "Dell OptiPlex Desktop", category: "ICT Equipment", custodian: "IT Unit" },
    { asset_code: "AST-DEMO-00002", name: "HP LaserJet Printer", category: "ICT Equipment", custodian: "Registry" },
    { asset_code: "AST-DEMO-00003", name: "Executive Office Desk", category: "Furniture", custodian: "Director Office" },
    { asset_code: "AST-DEMO-00004", name: "Conference Table", category: "Furniture", custodian: "Board Room" },
    { asset_code: "AST-DEMO-00005", name: "Toyota Hilux Utility", category: "Vehicles", custodian: "Transport" },
  ];
  for (let i = 0; i < assets.length; i += 1) {
    const st = states[i % states.length];
    await StoreAsset.create({
      ...assets[i],
      asset_number: assets[i].asset_code,
      nhia_tag_number: `NHIA-TAG-${1000 + i}`,
      specific_location: st.description,
      physical_condition: "Good",
      verification_status: "Unverified",
      status: "ACTIVE",
      zonal_code: st.zonal_code,
      state_code: st.code,
    });
  }

  // PAV session
  const ref = "PAV-DEMO-00001";
  const st0 = states[0];
  await PhysicalAssetVerification.create({
    reference_no: ref,
    stocktaking_type: "periodic",
    verification_date: "2026-10-20",
    store_keeper: "Store Officer",
    audit_officer: "Internal Audit",
    status: "DRAFT",
    remarks: "Demo physical verification",
    zonal_code: st0.zonal_code,
    state_code: st0.code,
  });
  let line = 1;
  for (const a of assets.slice(0, 4)) {
    await PhysicalAssetVerificationItem.create({
      reference_no: ref,
      line_no: line,
      asset_code: a.asset_code,
      asset_name: a.name,
      category: a.category,
      custodian: a.custodian,
      book_balance: 1,
      physical_count: 1,
      variance: 0,
      condition: "Good",
    });
    line += 1;
  }

  const bal = await StoreInventoryItem.findAll({ attributes: ["item_code", "name", "quantity_on_hand"] });
  console.log("Inventory balances:");
  bal.forEach((b) => console.log(`  ${b.item_code}  ${b.name}  qty=${b.quantity_on_hand}`));
  console.log("Seeded assets:", assets.length, "PAV:", ref);
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
