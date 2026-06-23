/**
 * Add participating_institutions to programmes_monthly_reports (idempotent).
 * Run: node src/scripts/addParticipatingInstitutions.js
 */
require("dotenv").config();
const sequelize = require("../config/database");

(async () => {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'programmes_monthly_reports'
         AND COLUMN_NAME = 'participating_institutions'`
    );
    if (Number(rows[0].cnt) > 0) {
      console.log("⏭   participating_institutions already exists");
    } else {
      await sequelize.query(
        `ALTER TABLE programmes_monthly_reports
         ADD COLUMN participating_institutions INT UNSIGNED NULL DEFAULT 0
         AFTER tiship_lives`
      );
      console.log("✅  Added participating_institutions column");
    }
    process.exit(0);
  } catch (err) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  }
})();
