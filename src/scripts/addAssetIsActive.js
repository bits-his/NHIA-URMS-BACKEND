/**
 * Add is_active to stock_assets for soft deactivation (idempotent).
 * Run: npm run db:migrate-asset-is-active
 */
require("dotenv").config();
const sequelize = require("../config/database");

(async () => {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'stock_assets'
         AND COLUMN_NAME = 'is_active'`
    );
    if (Number(rows[0].cnt) > 0) {
      console.log("⏭   stock_assets.is_active already exists");
    } else {
      await sequelize.query(
        `ALTER TABLE stock_assets
         ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
         AFTER book_balance`
      );
      console.log("✅  Added stock_assets.is_active column");
    }
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
