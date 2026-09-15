/**
 * Seed national HCF master facilities from data/HCF_Master_Data.xlsx
 * and mirror unique HCPs into nhia_accredited_providers for existing selectors.
 *
 *   node src/scripts/seedHcfMasterFacilities.js
 *   npm run db:seed-hcf
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");
const sequelize = require("../config/database");
const { HcfFacility, NhiaAccreditedProvider, StateOffice } = require("../models");

const EXCEL_PATH = path.join(__dirname, "../../data/HCF_Master_Data.xlsx");

const SKIP_SHEETS = new Set(["Sheet19"]);

/** Normalize Excel header → canonical field */
const HEADER_MAP = {
  "email address": "email",
  "name of facility": "name",
  "address of facility/location": "address",
  "address of facility/location 2": "address_2",
  "has the accreditation team ensured the service being inspected is for reaccreditation?? address of facility/location 2": "address_2",
  state: "state_name",
  "l.g.a": "lga",
  "phone number 1": "phone_1",
  "phone number 2": "phone_2",
  "type of facility": "facility_type",
  "service applied for": "service_applied_for",
  "name of contact person": "contact_person",
  "name of contact": "contact_person",
  "name of optometrist": "optometrist",
  "current accreditation code": "accreditation_code",
  "current nhis code": "accreditation_code",
  "facility code": "facility_code",
  "standby generator": "standby_generator",
};

const STATE_ALIASES = {
  abuja: "FCT (Abuja)",
  fct: "FCT (Abuja)",
  "fct (abuja)": "FCT (Abuja)",
  "abuja fct": "FCT (Abuja)",
  "federal capital territory": "FCT (Abuja)",
  "akwa ibom": "Akwa-Ibom",
  "akwa-ibom": "Akwa-Ibom",
  "cross river": "Cross River",
  "cross rivers": "Cross River",
  nassarawa: "Nasarawa",
  nasarawa: "Nasarawa",
  river: "Rivers",
  rivers: "Rivers",
  "rivers state": "Rivers",
  "lagos state": "Lagos",
  "kano state": "Kano",
  "kwara state": "Kwara",
  "edo state": "Edo",
  "oyo state": "Oyo",
  "ogun state": "Ogun",
  "ondo state": "Ondo",
  "osun state": "Osun",
  "ekiti state": "Ekiti",
  "benue state": "Benue",
  "plateau state": "Plateau",
  "kaduna state": "Kaduna",
  "katsina state": "Katsina",
  "sokoto state": "Sokoto",
  "zamfara state": "Zamfara",
  "jigawa state": "Jigawa",
  "kebbi state": "Kebbi",
  "bauchi state": "Bauchi",
  "borno state": "Borno",
  "yobe state": "Yobe",
  "gombe state": "Gombe",
  "adamawa state": "Adamawa",
  "taraba state": "Taraba",
  "kogi state": "Kogi",
  "niger state": "Niger",
  "anambra state": "Anambra",
  "enugu state": "Enugu",
  "imo state": "Imo",
  "abia state": "Abia",
  "ebonyi state": "Ebonyi",
  "delta state": "Delta",
  "bayelsa state": "Bayelsa",
};

function clean(v) {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  const s = String(v).replace(/\s+/g, " ").trim();
  return s || null;
}

function normalizeHeader(h) {
  return String(h || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeFacilityType(v) {
  const s = clean(v);
  if (!s) return null;
  const low = s.toLowerCase();
  if (low === "public") return "Public";
  if (low === "private") return "Private";
  return s;
}

function normalizeStateName(raw) {
  const s = clean(raw);
  if (!s) return null;
  const key = s.toLowerCase().replace(/\./g, "").trim();
  if (STATE_ALIASES[key]) return STATE_ALIASES[key];
  // strip trailing "State"
  const stripped = key.replace(/\s+state$/, "").trim();
  if (STATE_ALIASES[stripped]) return STATE_ALIASES[stripped];
  // Title case fallback
  return s.replace(/\s+state$/i, "").trim();
}

function looksLikeCode(code) {
  if (!code) return false;
  const bad = /^(yes|no|nil|n\/a|na|none|0000|\-+)$/i;
  if (bad.test(code.trim())) return false;
  return /[A-Za-z]{1,4}\s*[\/\-]?\s*\d+/.test(code) || /^[A-Za-z]{2,3}\/\d+/.test(code);
}

function syntheticCode(name, stateName, service) {
  const hash = crypto
    .createHash("sha1")
    .update(`${name}|${stateName || ""}|${service || ""}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `HCF/${hash}`;
}

function mapRow(headers, values, sheetName) {
  const mapped = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[normalizeHeader(h)];
    if (!key) return;
    if (mapped[key] == null || mapped[key] === "") {
      mapped[key] = clean(values[i]);
    }
  });

  const name = clean(mapped.name);
  if (!name) return null;

  // ENT sheet stores Yes/No in address_2 column
  let address_2 = mapped.address_2;
  if (address_2 && /^(yes|no)$/i.test(address_2)) {
    address_2 = null;
  }

  const contact = [mapped.contact_person, mapped.optometrist].filter(Boolean).join(" / ") || null;

  return {
    email: mapped.email || null,
    name,
    address: mapped.address || null,
    address_2: address_2 || null,
    state_name: normalizeStateName(mapped.state_name) || clean(mapped.state_name),
    lga: mapped.lga || null,
    phone_1: mapped.phone_1 || null,
    phone_2: mapped.phone_2 || null,
    facility_type: normalizeFacilityType(mapped.facility_type),
    service_applied_for: mapped.service_applied_for || sheetName,
    contact_person: contact,
    accreditation_code: mapped.accreditation_code || mapped.facility_code || null,
    facility_code: mapped.facility_code || null,
    standby_generator: mapped.standby_generator || null,
    source_sheet: sheetName,
    is_active: true,
  };
}

async function buildStateLookup() {
  const states = await StateOffice.findAll({
    attributes: ["id", "description", "zonal_id", "code"],
  });
  const byDesc = new Map();
  for (const s of states) {
    const d = (s.description || "").trim();
    byDesc.set(d.toLowerCase(), s);
    // also index without parentheses content
    const plain = d.replace(/\(.*?\)/g, "").trim().toLowerCase();
    if (plain && !byDesc.has(plain)) byDesc.set(plain, s);
  }
  // alias keys → state description in DB
  const aliasToState = {};
  for (const [alias, canon] of Object.entries(STATE_ALIASES)) {
    aliasToState[alias] = canon;
  }
  return { byDesc, aliasToState };
}

function resolveState(stateName, lookup) {
  if (!stateName) return { state_id: null, zone_id: null };
  const key = stateName.toLowerCase();
  let hit = lookup.byDesc.get(key);
  if (!hit) {
    const canon = lookup.aliasToState[key] || STATE_ALIASES[key];
    if (canon) hit = lookup.byDesc.get(canon.toLowerCase());
  }
  if (!hit) {
    // fuzzy: startswith / includes
    for (const [desc, row] of lookup.byDesc.entries()) {
      if (desc.includes(key) || key.includes(desc)) {
        hit = row;
        break;
      }
    }
  }
  if (!hit) return { state_id: null, zone_id: null };
  return { state_id: hit.id, zone_id: hit.zonal_id || null };
}

async function seed() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found at ${EXCEL_PATH}`);
  }

  console.log(`📖  Reading ${EXCEL_PATH}`);
  await HcfFacility.sync({ alter: true });

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: false });
  const stateLookup = await buildStateLookup();

  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    if (!matrix.length) continue;
    const headers = matrix[0];
    let sheetCount = 0;
    for (let i = 1; i < matrix.length; i++) {
      const mapped = mapRow(headers, matrix[i], sheetName);
      if (!mapped) continue;
      const geo = resolveState(mapped.state_name, stateLookup);
      rows.push({ ...mapped, ...geo });
      sheetCount += 1;
    }
    console.log(`  ✓  ${sheetName}: ${sheetCount} rows`);
  }

  console.log(`\n🗑   Clearing existing hcf_facilities…`);
  await HcfFacility.destroy({ where: {}, truncate: true });

  console.log(`💾  Inserting ${rows.length} HCF rows…`);
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await HcfFacility.bulkCreate(chunk, { validate: true });
    process.stdout.write(`  … ${Math.min(i + CHUNK, rows.length)} / ${rows.length}\r`);
  }
  console.log(`\n✅  hcf_facilities seeded: ${rows.length}`);

  // Mirror unique facilities into nhia_accredited_providers for AccreditedProviderSelect
  console.log(`\n🔗  Syncing unique HCPs into nhia_accredited_providers…`);
  await NhiaAccreditedProvider.sync();

  const unique = new Map();
  for (const r of rows) {
    let code = looksLikeCode(r.accreditation_code)
      ? r.accreditation_code.replace(/\s+/g, "").toUpperCase()
      : null;
    if (!code) {
      code = syntheticCode(r.name, r.state_name, r.service_applied_for);
    }
    // Prefer base facility key when code has service suffix: keep first, enrich later
    if (!unique.has(code)) {
      unique.set(code, {
        provider_type: "hcp",
        provider_code: code.slice(0, 100),
        name: r.name.slice(0, 500),
        address: [r.address, r.address_2, r.lga, r.state_name].filter(Boolean).join(", ").slice(0, 500) || null,
        email: r.email ? r.email.slice(0, 255) : null,
        phone: r.phone_1 ? r.phone_1.slice(0, 100) : null,
        facility_type: r.facility_type || null,
      });
    }
  }

  let upserted = 0;
  const providers = [...unique.values()];
  for (let i = 0; i < providers.length; i += CHUNK) {
    const chunk = providers.slice(i, i + CHUNK);
    for (const p of chunk) {
      const [row, created] = await NhiaAccreditedProvider.findOrCreate({
        where: { provider_type: "hcp", provider_code: p.provider_code },
        defaults: p,
      });
      if (!created) {
        await row.update({
          name: p.name,
          address: p.address || row.address,
          email: p.email || row.email,
          phone: p.phone || row.phone,
          facility_type: p.facility_type || row.facility_type,
        });
      }
      upserted += 1;
    }
    process.stdout.write(`  … ${Math.min(i + CHUNK, providers.length)} / ${providers.length}\r`);
  }
  console.log(`\n✅  nhia_accredited_providers HCP upserted: ${upserted}`);

  const totalHcf = await HcfFacility.count();
  const totalHcp = await NhiaAccreditedProvider.count({ where: { provider_type: "hcp" } });
  console.log(`\n📊  hcf_facilities=${totalHcf}  accredited HCP=${totalHcp}`);
}

if (require.main === module) {
  seed()
    .then(() => sequelize.close())
    .catch(async (err) => {
      console.error("❌  HCF seed failed:", err);
      await sequelize.close().catch(() => {});
      process.exit(1);
    });
}

module.exports = seed;
