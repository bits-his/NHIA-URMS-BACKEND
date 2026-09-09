/**
 * Seed accredited HMOs from data/Accredited_HMOs_2025.xlsx
 * and mirror into nhia_accredited_providers for existing selectors.
 *
 *   node src/scripts/seedHmoProviders.js
 *   npm run db:seed-hmo
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const sequelize = require("../config/database");
const { HmoProvider, NhiaAccreditedProvider } = require("../models");

const EXCEL_PATH = path.join(__dirname, "../../data/Accredited_HMOs_2025.xlsx");

/** Excel often uses letter O instead of digit 0 in codes/phones */
function fixOZero(s) {
  return String(s || "").replace(/O/g, "0").replace(/o(?=\d)/g, "0");
}

function clean(v) {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  const s = String(v).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return s || null;
}

function normalizeHmoCode(raw) {
  let s = fixOZero(String(raw ?? "").trim());
  s = s.replace(/\s+/g, "");
  if (/^\d+$/.test(s)) {
    // O1 → 01 → 1 (match existing nhia_accredited_providers style)
    s = String(parseInt(s, 10));
  }
  return s.slice(0, 40);
}

function normalizePhone(raw) {
  if (raw == null) return null;
  let s = clean(raw);
  if (!s) return null;
  // Fix leading O used as 0 in phone lists, keep commas
  s = s
    .split(/[,;]+/)
    .map((p) => fixOZero(p.trim()).replace(/\s+/g, ""))
    .filter(Boolean)
    .join(", ");
  return s.slice(0, 500) || null;
}

function normalizeEmail(raw) {
  if (raw == null) return null;
  const s = clean(raw);
  if (!s) return null;
  return s
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)
    .join(", ")
    .slice(0, 500) || null;
}

function findHeaderRow(matrix) {
  for (let i = 0; i < Math.min(30, matrix.length); i++) {
    const row = matrix[i].map((c) => String(c || "").trim().toUpperCase());
    if (row.includes("HMO CODE") && row.some((c) => c.includes("NAME"))) {
      return i;
    }
  }
  return -1;
}

function parseSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIdx = findHeaderRow(matrix);
  if (headerIdx < 0) return [];

  const headers = matrix[headerIdx].map((h) => String(h || "").trim().toUpperCase());
  const iSn = headers.findIndex((h) => h === "S/N" || h === "SN");
  const iCode = headers.findIndex((h) => h.includes("HMO CODE") || h === "CODE");
  const iName = headers.findIndex((h) => h.includes("NAME"));
  const iAddr = headers.findIndex((h) => h.includes("ADDRESS"));
  const iEmail = headers.findIndex((h) => h.includes("EMAIL"));
  const iPhone = headers.findIndex((h) => h.includes("CALL") || h.includes("PHONE") || h.includes("CENTRE") || h.includes("CENTER"));

  const out = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    const name = clean(row[iName]);
    if (!name) continue;
    const codeRaw = clean(row[iCode]);
    if (codeRaw == null || codeRaw === "") continue;
    const hmo_code = normalizeHmoCode(codeRaw);
    if (!hmo_code) continue;

    out.push({
      serial_no: row[iSn] != null && String(row[iSn]).trim() !== "" ? parseInt(row[iSn], 10) || null : null,
      hmo_code,
      hmo_code_raw: String(codeRaw).trim().slice(0, 40),
      name: name.slice(0, 500),
      address: clean(row[iAddr]),
      email: normalizeEmail(row[iEmail]),
      call_centre: normalizePhone(row[iPhone]),
      source_sheet: sheetName,
      is_active: true,
    });
  }
  return out;
}

async function seed() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found at ${EXCEL_PATH}`);
  }

  console.log(`📖  Reading ${EXCEL_PATH}`);
  await HmoProvider.sync({ alter: true });
  await NhiaAccreditedProvider.sync();

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: false });
  // Prefer Sheet2 (official S/N order); fall back to Sorted A-Z
  const preferred = workbook.SheetNames.includes("Sheet2") ? "Sheet2" : workbook.SheetNames[0];
  let rows = parseSheet(workbook, preferred);
  console.log(`  ✓  ${preferred}: ${rows.length} HMOs`);

  if (!rows.length && workbook.SheetNames.includes("Sorted A-Z")) {
    rows = parseSheet(workbook, "Sorted A-Z");
    console.log(`  ✓  Sorted A-Z: ${rows.length} HMOs`);
  }

  // Deduplicate by hmo_code (keep first)
  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.hmo_code)) byCode.set(r.hmo_code, r);
  }
  rows = [...byCode.values()];

  console.log(`\n🗑   Clearing existing hmo_providers…`);
  await HmoProvider.destroy({ where: {}, truncate: true });

  console.log(`💾  Inserting ${rows.length} HMO rows…`);
  await HmoProvider.bulkCreate(rows, { validate: true });
  console.log(`✅  hmo_providers seeded: ${rows.length}`);

  console.log(`\n🔗  Syncing into nhia_accredited_providers (hmo)…`);
  let upserted = 0;
  for (const r of rows) {
    const payload = {
      provider_type: "hmo",
      provider_code: r.hmo_code.slice(0, 100),
      name: r.name,
      address: r.address ? r.address.replace(/\n+/g, ", ").slice(0, 500) : null,
      email: r.email ? r.email.split(",")[0].trim().slice(0, 255) : null,
      phone: r.call_centre ? r.call_centre.slice(0, 100) : null,
      facility_type: "HMO",
    };
    const [row, created] = await NhiaAccreditedProvider.findOrCreate({
      where: { provider_type: "hmo", provider_code: payload.provider_code },
      defaults: payload,
    });
    if (!created) {
      await row.update({
        name: payload.name,
        address: payload.address || row.address,
        email: payload.email || row.email,
        phone: payload.phone || row.phone,
        facility_type: payload.facility_type,
      });
    }
    upserted += 1;
  }
  console.log(`✅  nhia_accredited_providers HMO upserted: ${upserted}`);

  const totalHmoTable = await HmoProvider.count();
  const totalHmoAccred = await NhiaAccreditedProvider.count({ where: { provider_type: "hmo" } });
  console.log(`\n📊  hmo_providers=${totalHmoTable}  accredited HMO=${totalHmoAccred}`);
}

if (require.main === module) {
  seed()
    .then(() => sequelize.close())
    .catch(async (err) => {
      console.error("❌  HMO seed failed:", err);
      await sequelize.close().catch(() => {});
      process.exit(1);
    });
}

module.exports = seed;
