/**
 * Grant ICT and Admin / Human Resource pages to users who already have Zonal access.
 * Run: node src/scripts/legacy/addIctAdminHrPrivileges.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { User } = require("../../models/User");

const ZONAL = "Zonal";
const NEW_FUNCS = [
  "ICT Support",
  "Meetings",
  "ETMC Cascading",
  "Accommodation",
  "Utilities",
  "Vehicles",
  "Staff Feedback",
  "Infractions",
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
      const idx = access.findIndex((e) => e?.access_to === ZONAL || e?.access_to === "Others");
      if (idx < 0) continue;

      const funcs = Array.isArray(access[idx].functionalities)
        ? [...access[idx].functionalities]
        : [];
      let changed = false;
      for (const title of NEW_FUNCS) {
        if (!funcs.includes(title)) {
          funcs.push(title);
          changed = true;
          console.log(`  ✔  Added ${title} → ${user.staff_id}`);
        }
      }
      if (!changed) continue;

      access[idx] = { ...access[idx], access_to: ZONAL, functionalities: funcs };
      await user.update({ functionalities: access });
      updated += 1;
    }

    console.log(`\n✅  Done — ${updated} user(s) updated`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
