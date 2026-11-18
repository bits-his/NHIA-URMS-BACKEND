/**
 * Moderate store-asset rows so Stock Verification / Store dashboards paint.
 * Idempotent — replaces AST-VIS-* assets only.
 *
 *   node src/scripts/seedStoreDashboardDemo.js
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { StoreAsset, StateOffice } = require("../models");

const NAMES = [
  "Executive Office Desk", "HP LaserJet Printer", "Split Air Conditioner", "Dell OptiPlex Desktop",
  "Metal Filing Cabinet", "Conference Room Projector", "Lenovo Laptop", "Document Scanner",
  "Office Generator", "Network Server", "Visitor Chair", "Photocopier",
];
const CATS = ["Office Furniture", "Office Equipment", "Computer Equipment", "Office Equipment"];
const CONDITIONS = ["Good", "Good", "Fair", "Defective", "Good", "Poor", "Excellent", "Under Repair"];
const VERIFY = ["Verified & Passed", "Verified & Passed", "Exception", "Unverified", "Verified & Passed", "Missing"];
const STATUS = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "OBSOLETE", "RETIRED"];

const pad = (n, w = 2) => String(n).padStart(w, "0");

async function main() {
  await sequelize.authenticate();
  if (!StoreAsset) throw new Error("StoreAsset model not loaded");

  const states = await StateOffice.findAll({ order: [["zonal_code", "ASC"], ["code", "ASC"]], limit: 18 });
  if (!states.length) throw new Error("No state_offices");

  const cleared = await StoreAsset.destroy({ where: { asset_code: { [Op.like]: "AST-VIS-%" } } });
  if (cleared) console.log(`Cleared ${cleared} previous AST-VIS assets`);

  const rows = [];
  states.forEach((state, si) => {
    const count = 4 + (si % 3); // 4–6 assets per state
    for (let i = 0; i < count; i += 1) {
      const code = `AST-VIS-${state.code}-${pad(i + 1)}`;
      rows.push({
        asset_code: code,
        asset_number: code,
        nhia_tag_number: i % 5 === 0 ? null : `NHIA-${state.code}-${pad(i + 1)}`,
        name: NAMES[(si + i) % NAMES.length],
        description: `${NAMES[(si + i) % NAMES.length]} at ${state.description} Store`,
        category: CATS[(si + i) % CATS.length],
        custodian: `${state.description} Store Keeper`,
        specific_location: i % 3 === 0 ? "Main store" : "Office floor",
        physical_condition: CONDITIONS[(si + i) % CONDITIONS.length],
        verification_status: VERIFY[(si + i) % VERIFY.length],
        last_verification_date: `2026-${pad(((si + i) % 9) + 1)}-15`,
        acquisition_date: `2024-${pad(((si + i) % 12) + 1)}-10`,
        acquisition_cost: 85000 + ((si * 17 + i * 11) % 40) * 1000,
        status: STATUS[(si + i) % STATUS.length],
        zonal_code: state.zonal_code,
        state_code: state.code,
      });
    }
  });

  await StoreAsset.bulkCreate(rows, { logging: false });
  console.log(`Seeded ${rows.length} store assets across ${states.length} states`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try { await sequelize.close(); } catch { /* ignore */ }
  process.exit(1);
});
