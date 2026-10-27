/**
 * DROP every table that is NOT in the activeSchema allowlist
 * (users + reference data + approved forms only).
 *
 * Usage (required flag):
 *   node src/scripts/redesign/purgeNonCoreTables.js --confirm
 *
 * Dry run:
 *   node src/scripts/redesign/purgeNonCoreTables.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const { allowedTables, CORE_TABLES, APPROVED_FORMS } = require("../../config/activeSchema");

const confirm = process.argv.includes("--confirm");

(async () => {
  try {
    await sequelize.authenticate();
    const db = sequelize.config.database;
    const allow = allowedTables();

    const [rows] = await sequelize.query(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      { replacements: [db] },
    );

    const existing = rows.map((r) => r.name || r.NAME);
    const toDrop = existing.filter((t) => !allow.has(t));
    const toKeep = existing.filter((t) => allow.has(t));

    console.log(`Database: ${db}`);
    console.log(`Keep (${toKeep.length}):`, toKeep.join(", ") || "(none yet)");
    console.log(`Drop (${toDrop.length}):`, toDrop.join(", ") || "(nothing)");
    console.log(`Core allowlist: ${CORE_TABLES.length} | Approved forms: ${Object.keys(APPROVED_FORMS).length}`);

    if (!toDrop.length) {
      console.log("✅  Nothing to drop");
      process.exit(0);
    }

    if (!confirm) {
      console.log("\nDry run only. Re-run with --confirm to DROP the tables listed above.");
      process.exit(0);
    }

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of toDrop) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`  dropped ${table}`);
    }
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    const [after] = await sequelize.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      { replacements: [db] },
    );
    console.log(`\n✅  Purge complete. Tables remaining: ${after[0].c}`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Purge failed:", err);
    process.exit(1);
  }
})();
