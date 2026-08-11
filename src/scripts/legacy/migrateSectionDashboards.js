/**
 * Grant section dashboard privileges to users who already have access to each SDO/SOC area.
 *
 * Run: node src/scripts/legacy/migrateSectionDashboards.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { User } = require("../../models/User");

const SOC_ZONES = "SOC/Zones";
const SDO = "SDO";
const DASHBOARD = "Dashboard";

const SERVICOM_FUNCS = new Set([
  "SERVICOM Dashboard", "Dashboard", "Charter Performance", "Complaints Management",
  "Customer Satisfaction Survey", "Citizens' Comment Card", "Complaints", "Complaints Register",
]);

const STOCK_FUNCS = new Set([
  "Stock Verification Dashboard", "Stock Verification", "Physical Asset Verification",
  "Verification of Supply", "Asset Register", "Asset Master Register",
]);

function parseAccess(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function ensureFunc(entry, title) {
  const funcs = Array.isArray(entry.functionalities) ? [...entry.functionalities] : [];
  if (funcs.includes(title)) return false;
  funcs.push(title);
  entry.functionalities = funcs;
  return true;
}

(async () => {
  try {
    await sequelize.authenticate();
    const users = await User.findAll();
    let updated = 0;

    for (const user of users) {
      if (user.role === "admin") continue;
      const access = parseAccess(user.functionalities);
      let changed = false;

      const sdoIdx = access.findIndex((e) => e?.access_to === SDO);
      if (sdoIdx >= 0) {
        const funcs = access[sdoIdx].functionalities ?? [];
        if (funcs.some((f) => SERVICOM_FUNCS.has(f))) {
          changed = ensureFunc(access[sdoIdx], "SERVICOM Dashboard") || changed;
        }
        if (funcs.some((f) => STOCK_FUNCS.has(f))) {
          changed = ensureFunc(access[sdoIdx], "Stock Verification Dashboard") || changed;
        }
        if (funcs.length > 0) {
          changed = ensureFunc(access[sdoIdx], "Special Project") || changed;
        }
      }

      const dashIdx = access.findIndex((e) => e?.access_to === DASHBOARD);
      if (dashIdx >= 0) {
        const funcs = access[dashIdx].functionalities ?? [];
        if (funcs.includes("Overview") || funcs.includes("Statistics")) {
          changed = ensureFunc(access[dashIdx], "Dashboard") || changed;
        }
      }

      const socIdx = access.findIndex((e) => e?.access_to === SOC_ZONES || e?.access_to === "State Offices");
      if (socIdx >= 0) {
        const funcs = access[socIdx].functionalities ?? [];
        if (funcs.length > 0) {
          changed = ensureFunc(access[socIdx], "SOC/Zones Dashboard") || changed;
        }
      }

      if (changed) {
        await user.update({ functionalities: access });
        updated += 1;
        console.log(`  ✔  ${user.staff_id}`);
      }
    }

    console.log(`\n✅  Done — ${updated} user(s) updated with section dashboard access`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
