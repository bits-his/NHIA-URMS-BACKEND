/**
 * Create / update all tables from Sequelize models.
 *
 * Prefer: npm run db:setup   (sync + seed for a new database)
 * Or:     npm run db:sync    (schema only)
 *
 * Use { force: true } to DROP and recreate (destructive — dev only).
 */
require("dotenv").config();
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

// Register all models & associations
require("../models/index");
const { User } = require("../models/User");
const { fixOrphanForeignKeys, alignIntegerForeignKeys } = require("../utils/fixOrphanForeignKeys");
const { repairAnnualReportKeys } = require("../utils/repairAnnualReportKeys");
const { dedupeDuplicateIndexes } = require("../utils/dedupeDuplicateIndexes");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    const cleared = await fixOrphanForeignKeys(sequelize, { log: true });
    if (cleared) {
      console.log(`ℹ️   Cleared ${cleared} orphan FK reference(s) before sync`);
    }

    const aligned = await alignIntegerForeignKeys(sequelize, { log: true });
    if (aligned) {
      console.log(`ℹ️   Aligned ${aligned} integer FK column type(s) before sync`);
    }

    // Re-run after type alignment in case signed/unsigned remaps exposed more orphans
    const clearedAgain = await fixOrphanForeignKeys(sequelize, { log: true });
    if (clearedAgain) {
      console.log(`ℹ️   Cleared ${clearedAgain} additional orphan FK reference(s) after type align`);
    }

    const deduped = await dedupeDuplicateIndexes(sequelize, { log: true });
    if (deduped) {
      console.log(`ℹ️   Dropped ${deduped} duplicate index(es) before sync`);
    }

    await repairAnnualReportKeys(sequelize);

    await sequelize.sync({ alter: true });
    console.log("✅  Tables synced");

    // alter:true often re-adds UNIQUE indexes; clean once more so the next sync stays under MySQL's 64-key limit
    const dedupedAfter = await dedupeDuplicateIndexes(sequelize, { log: false });
    if (dedupedAfter) {
      console.log(`ℹ️   Dropped ${dedupedAfter} duplicate index(es) after sync`);
    }

    // Seed default admin if none exists
    const existing = await User.findOne({ where: { role: "admin" } });
    if (!existing) {
      const hashed = await bcrypt.hash("Admin@1234", 12);
      await User.create({
        name: "System Administrator",
        staff_id: "ADMIN001",
        email: "admin@nhia.gov.ng",
        password: hashed,
        role: "admin",
      });
      console.log("✅  Default admin created → staff_id: ADMIN001 / password: Admin@1234");
    } else {
      console.log("ℹ️   Admin user already exists, skipping seed");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌  Sync failed:", err);
    process.exit(1);
  }
})();
