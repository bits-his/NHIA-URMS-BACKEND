/**
 * Move state office report privileges from SOC/Zones → Zonal and grant
 * new SOC placeholder pages. Renames legacy access_to "Others" → "Zonal".
 *
 * Run: node src/scripts/legacy/migrateOthersPrivileges.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { User } = require("../../models/User");

const SOC_ZONES = "SOC/Zones";
const ZONAL = "Zonal";
const ZONAL_LEGACY = "Others";
const LEGACY_MODULE = "State Offices";

const ZONAL_CANONICAL = new Set([
  "Enrolment",
  "Migration / Update Requests",
  "CEmONC & FFP Beneficiaries",
  "Monitoring Visits",
  "Accreditation / Reaccreditation",
  "Stakeholder Engagement",
  "HMO Selection Process",
  "Additional / Extra Dependant",
  "Change of HCF",
  "Challenges & Recommendations",
  "IGR",
  "SSHIA Financial Report",
  "Expenditure Profile",
  "ICT Support",
  "Meetings",
  "ETMC Cascading",
  "Accommodation",
  "Utilities",
  "Vehicles",
  "Staff Feedback",
  "Infractions",
]);

const LEGACY_TO_CANONICAL = {
  "Compliance Monitoring": "Monitoring Visits",
  "Enrollee Complaints": "Monitoring Visits",
};

const SOC_PLACEHOLDER_FUNCS = [
  "Operation Monitoring Visit",
  "Spot Check Visit",
];

function normalizeFunc(title) {
  return LEGACY_TO_CANONICAL[title] ?? title;
}

function parseAccess(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function mergeUnique(arr, items) {
  const set = new Set(arr);
  for (const item of items) set.add(item);
  return [...set];
}

function renameOthersToZonal(access) {
  const legacyIdx = access.findIndex((e) => e?.access_to === ZONAL_LEGACY);
  const zonalIdx = access.findIndex((e) => e?.access_to === ZONAL);
  if (legacyIdx < 0) return access;

  const legacy = access[legacyIdx];
  if (zonalIdx >= 0) {
    access[zonalIdx] = {
      ...access[zonalIdx],
      functionalities: mergeUnique(
        access[zonalIdx].functionalities ?? [],
        legacy.functionalities ?? [],
      ),
    };
    access.splice(legacyIdx, 1);
  } else {
    access[legacyIdx] = { ...legacy, access_to: ZONAL };
  }
  return access;
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

      const beforeLen = access.length;
      access = renameOthersToZonal(access);
      if (access.length !== beforeLen || access.some((e) => e?.access_to === ZONAL)) {
        changed = changed || access.some((e, i) => e?.access_to === ZONAL);
      }
      const hadLegacy = parseAccess(user.functionalities).some((e) => e?.access_to === ZONAL_LEGACY);
      if (hadLegacy) changed = true;

      const socIdx = access.findIndex(
        (e) => e?.access_to === SOC_ZONES || e?.access_to === LEGACY_MODULE,
      );

      if (socIdx >= 0) {
        const socEntry = access[socIdx];
        const rawFuncs = Array.isArray(socEntry.functionalities) ? [...socEntry.functionalities] : [];
        const zonalFuncs = [];
        const socFuncs = [];

        for (const f of rawFuncs) {
          const canon = normalizeFunc(f);
          if (ZONAL_CANONICAL.has(canon)) {
            zonalFuncs.push(canon);
          } else {
            socFuncs.push(f);
          }
        }

        if (zonalFuncs.length > 0) {
          const zonalIdx = access.findIndex((e) => e?.access_to === ZONAL);
          if (zonalIdx >= 0) {
            access[zonalIdx] = {
              ...access[zonalIdx],
              functionalities: mergeUnique(access[zonalIdx].functionalities ?? [], zonalFuncs),
            };
          } else {
            access.push({ access_to: ZONAL, functionalities: [...new Set(zonalFuncs)] });
          }
          changed = true;
        }

        if (socFuncs.length > 0 || zonalFuncs.length > 0) {
          const withPlaceholders = mergeUnique(socFuncs, SOC_PLACEHOLDER_FUNCS);
          access[socIdx] = {
            access_to: SOC_ZONES,
            functionalities: withPlaceholders,
          };
          changed = true;
        } else if (socEntry.access_to === LEGACY_MODULE) {
          access.splice(socIdx, 1);
          changed = true;
        }
      }

      const sdoIdx = access.findIndex((e) => e?.access_to === "SDO");
      if (sdoIdx >= 0) {
        const sdoFuncs = access[sdoIdx].functionalities ?? [];
        if (sdoFuncs.some((f) => normalizeFunc(f) === "Monitoring Visits")) {
          const zonalIdx = access.findIndex((e) => e?.access_to === ZONAL);
          if (zonalIdx >= 0) {
            if (!access[zonalIdx].functionalities.includes("Monitoring Visits")) {
              access[zonalIdx] = {
                ...access[zonalIdx],
                functionalities: [...access[zonalIdx].functionalities, "Monitoring Visits"],
              };
              changed = true;
            }
          } else {
            access.push({ access_to: ZONAL, functionalities: ["Monitoring Visits"] });
            changed = true;
          }
          const legacySocIdx = access.findIndex((e) => e?.access_to === SOC_ZONES);
          if (legacySocIdx >= 0) {
            const remaining = (access[legacySocIdx].functionalities ?? []).filter(
              (f) => normalizeFunc(f) !== "Monitoring Visits",
            );
            if (remaining.length !== (access[legacySocIdx].functionalities ?? []).length) {
              access[legacySocIdx] = { ...access[legacySocIdx], functionalities: remaining };
              changed = true;
            }
          }
        }
      }

      access = renameOthersToZonal(access);

      const zonalIdx = access.findIndex((e) => e?.access_to === ZONAL);
      if (zonalIdx >= 0) {
        const funcs = Array.isArray(access[zonalIdx].functionalities)
          ? [...access[zonalIdx].functionalities]
          : [];
        let funcChanged = false;
        for (const f of [
          "Additional / Extra Dependant",
          "Change of HCF",
          "ICT Support",
          "Meetings",
          "ETMC Cascading",
          "Accommodation",
          "Utilities",
          "Vehicles",
          "Staff Feedback",
          "Infractions",
        ]) {
          if (!funcs.includes(f)) {
            funcs.push(f);
            funcChanged = true;
            console.log(`  ✔  Added ${f} → ${user.staff_id}`);
          }
        }
        if (funcChanged) {
          access[zonalIdx] = { ...access[zonalIdx], functionalities: funcs };
          changed = true;
        }
      }

      if (changed) {
        await user.update({ functionalities: access });
        updated += 1;
        console.log(`  ✔  ${user.staff_id}`);
      }
    }

    console.log(`\n✅  Done — ${updated} user(s) updated (SOC/Zones → Zonal split)`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
