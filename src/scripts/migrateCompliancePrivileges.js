/**
 * Add Compliance Management to SQA module privileges.
 * Run: npm run db:migrate-compliance-privileges
 */
require("dotenv").config();
const sequelize = require("../config/database");
const { User } = require("../models/User");

const SQA_MODULE = "Standards & Quality Assurance";
const FUNC = "Compliance Management";

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
      const idx = access.findIndex(e => e?.access_to === SQA_MODULE);
      if (idx < 0) continue;

      const funcs = Array.isArray(access[idx].functionalities)
        ? [...access[idx].functionalities]
        : [];
      if (funcs.includes(FUNC)) continue;

      funcs.push(FUNC);
      access[idx] = { ...access[idx], functionalities: funcs };
      await user.update({ functionalities: access });
      console.log(`  ✔  Added ${FUNC} → ${user.staff_id}`);
      updated++;
    }

    console.log(`\n✅  Done — ${updated} user(s) updated`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
