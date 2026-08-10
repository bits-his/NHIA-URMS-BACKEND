/**
 * Clear orphan state_id / zone_id on SERVICOM tables so FK constraints can be added.
 * Run before db:sync on production when sync fails with ER_NO_REFERENCED_ROW_2.
 *
 *   npm run db:fix-servicom-fks
 */
require("dotenv").config();
const sequelize = require("../config/database");
const { fixOrphanForeignKeys } = require("../utils/fixOrphanForeignKeys");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connection OK");

    const cleared = await fixOrphanForeignKeys(sequelize, { log: true });
    if (cleared) {
      console.log(`✅  Cleared ${cleared} orphan FK reference(s)`);
    } else {
      console.log("ℹ️   No orphan FK references found");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌  Fix failed:", err.message);
    process.exit(1);
  }
})();
