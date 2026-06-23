/**
 * Run once to create / update all tables:
 *   node src/scripts/syncDb.js
 *
 * Use { force: true } to DROP and recreate (destructive — dev only).
 */
require("dotenv").config();
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

// Register all models & associations
require("../models/index");
const { User } = require("../models/User");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    await sequelize.sync({ alter: true });
    console.log("✅  Tables synced");

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
