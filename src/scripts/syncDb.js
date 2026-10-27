/**
 * Schema sync — ACTIVE tables only (form-by-form rebuild).
 * Does NOT recreate legacy report tables.
 *
 * Prefer: npm run db:sync:active
 */
require("dotenv").config();
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const { syncActiveSchema, User } = require("../models/active");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");
    console.log("ℹ️   Syncing ACTIVE schema only (legacy report tables will NOT be created)");

    await syncActiveSchema({ alter: true });

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
      console.log("✅  Default admin created → ADMIN001 / Admin@1234");
    } else {
      console.log("ℹ️   Admin user already exists");
    }

    console.log("✅  Active sync complete");
    process.exit(0);
  } catch (err) {
    console.error("❌  Sync failed:", err);
    process.exit(1);
  }
})();
