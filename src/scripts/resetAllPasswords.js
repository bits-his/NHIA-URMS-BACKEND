/**
 * Reset all user passwords in the database.
 * Default password: "123456" (or pass password as first CLI argument).
 *
 * Usage:
 *   node src/scripts/resetAllPasswords.js
 *   node src/scripts/resetAllPasswords.js "MyCustomPassword"
 *   npm run db:reset-passwords
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { User } = require("../models/User");
const sequelize = require("../config/database");

const targetPassword = process.argv[2] || "123456";

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`🔌 Connected to database: ${sequelize.config.database}`);

    console.log(`⏳ Hashing password...`);
    const hashedPassword = await bcrypt.hash(targetPassword, 12);

    const [updatedCount] = await User.update(
      { password: hashedPassword },
      { where: {} }
    );

    console.log(`✅ Successfully updated ${updatedCount} user(s) to password: "${targetPassword}"\n`);

    const users = await User.findAll({
      attributes: ["id", "staff_id", "email", "name", "role", "is_active"],
      order: [["id", "ASC"]],
    });

    console.table(users.map((u) => u.toJSON()));
    console.log(`\n🎉 All accounts are now active and ready to log in with password: "${targetPassword}"`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to reset passwords:", err);
    process.exit(1);
  }
})();

