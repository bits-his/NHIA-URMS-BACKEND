/**
 * Grant "Provider Management Dashboard" to every module entry of a user.
 * Run on production:  node src/scripts/grantProviderDashboardAccess.js [STAFF_ID ...]
 * Defaults to the coordination accounts when no staff ids are passed.
 */
const { User } = require("../models");
const sequelize = require("../config/database");

const PRIVILEGE = "Provider Management Dashboard";
const DEFAULT_IDS = ["SORO-0001", "SOCZC-0001", "SOCSC-0001", "SDO-0001"];

(async () => {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_IDS;
  for (const id of ids) {
    const u = await User.findOne({ where: { staff_id: id } });
    if (!u) { console.log(id, "NOT FOUND"); continue; }
    let f = u.functionalities;
    if (typeof f === "string") { try { f = JSON.parse(f); } catch { f = []; } }
    if (!Array.isArray(f)) { console.log(id, "no functionalities array"); continue; }
    let touched = 0;
    for (const e of f) {
      if (Array.isArray(e?.functionalities) && !e.functionalities.includes(PRIVILEGE)) {
        e.functionalities.push(PRIVILEGE);
        touched++;
      }
    }
    if (touched > 0) {
      const valueToSave = typeof u.functionalities === "string" ? JSON.stringify(f) : f;
      u.set("functionalities", valueToSave);
      u.changed("functionalities", true);
      await u.save();
    }
    console.log(id, `granted in ${touched} entries`);
  }
  await sequelize.close();
  process.exit(0);
})();
