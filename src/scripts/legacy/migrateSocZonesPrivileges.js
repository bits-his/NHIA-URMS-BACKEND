/**
 * Rename "State Offices" → "SOC/Zones" in user privileges and ensure
 * Weekly Actionable + Contracted Services are granted where SOC/Zones exists.
 *
 * Run: npm run db:migrate-soc-zones-privileges
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { User } = require("../../models/User");

const SOC_ZONES_MODULE = "SOC/Zones";
const LEGACY_MODULE = "State Offices";

const ALL_SOC_ZONES_FUNCS = [
  "SOC/Zones Dashboard",
  "State/Zonal Office Profile",
  "State/Zonal Focal Persons Register",
  "Weekly Actionable",
  "Contracted Services",
  "Operation Monitoring Visit",
  "Spot Check Visit",
];

function parseAccess(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

(async () => {
  try {
    await sequelize.authenticate();
    const users = await User.findAll();
    let updated = 0;

    for (const user of users) {
      if (user.role === "admin") continue;

      let access = parseAccess(user.functionalities);
      let changed = false;

      const legacyIdx = access.findIndex(e => e?.access_to === LEGACY_MODULE);
      const socIdx = access.findIndex(e => e?.access_to === SOC_ZONES_MODULE);

      if (legacyIdx >= 0) {
        const legacy = access[legacyIdx];
        const funcs = Array.isArray(legacy.functionalities) ? [...legacy.functionalities] : [];

        if (socIdx >= 0) {
          const merged = new Set([
            ...(access[socIdx].functionalities ?? []),
            ...funcs,
          ]);
          access[socIdx] = {
            ...access[socIdx],
            functionalities: [...merged],
          };
          access.splice(legacyIdx, 1);
        } else {
          access[legacyIdx] = {
            access_to: SOC_ZONES_MODULE,
            functionalities: funcs,
          };
        }
        changed = true;
        console.log(`  ✔  Renamed ${LEGACY_MODULE} → ${SOC_ZONES_MODULE} → ${user.staff_id}`);
      }

      const idx = access.findIndex(e => e?.access_to === SOC_ZONES_MODULE);

      if (idx >= 0) {
        const funcs = Array.isArray(access[idx].functionalities)
          ? [...access[idx].functionalities]
          : [];
        let funcChanged = false;

        for (const f of ALL_SOC_ZONES_FUNCS) {
          if (!funcs.includes(f)) {
            funcs.push(f);
            funcChanged = true;
            console.log(`  ✔  Added ${f} → ${user.staff_id}`);
          }
        }

        if (funcChanged) {
          access[idx] = { ...access[idx], functionalities: funcs };
          changed = true;
        }
      } else if (user.role === "state-coordinator") {
        access = [...access, { access_to: SOC_ZONES_MODULE, functionalities: ALL_SOC_ZONES_FUNCS }];
        changed = true;
        console.log(`  ✔  Granted ${SOC_ZONES_MODULE} → ${user.staff_id}`);
      }

      if (changed) {
        await user.update({ functionalities: access });
        updated++;
      }
    }

    console.log(`\n✅  Done — ${updated} user(s) updated`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
