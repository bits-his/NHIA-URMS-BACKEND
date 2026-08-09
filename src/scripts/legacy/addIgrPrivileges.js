/**
 * Add IGR to State Offices privileges for users who already have that module.
 * Also grants State Offices (all sections) to state-coordinator users missing it.
 * Run: npm run db:migrate-igr-privileges
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { User } = require("../../models/User");

const STATE_OFFICE_MODULE = "State Offices";
const ALL_STATE_OFFICE_FUNCS = [
  "Enrolment",
  "Migration / Update Requests",
  "CEmONC & FFP Beneficiaries",
  "IGR",
  "SSHIA Financial Report",
  "Expenditure Profile",
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

      const idx = access.findIndex(e => e?.access_to === STATE_OFFICE_MODULE);

      if (idx >= 0) {
        const funcs = Array.isArray(access[idx].functionalities) ? [...access[idx].functionalities] : [];
        if (!funcs.includes("IGR")) {
          funcs.push("IGR");
          changed = true;
          console.log(`  ✔  Added IGR → ${user.staff_id}`);
        }
        if (!funcs.includes("SSHIA Financial Report")) {
          funcs.push("SSHIA Financial Report");
          changed = true;
          console.log(`  ✔  Added SSHIA Financial Report → ${user.staff_id}`);
        }
        if (!funcs.includes("Expenditure Profile")) {
          funcs.push("Expenditure Profile");
          changed = true;
          console.log(`  ✔  Added Expenditure Profile → ${user.staff_id}`);
        }
        if (changed) {
          access[idx] = { ...access[idx], functionalities: funcs };
        }
      } else if (user.role === "state-coordinator") {
        access = [...access, { access_to: STATE_OFFICE_MODULE, functionalities: ALL_STATE_OFFICE_FUNCS }];
        changed = true;
        console.log(`  ✔  Granted State Offices → ${user.staff_id}`);
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
