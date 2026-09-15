/**
 * Create ETMC/TMC action-point register tables.
 *
 *   node src/scripts/legacy/addEtmcTmcActionPoint.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
const { EtmcTmcActionPointRegister, EtmcTmcActionPointLine } = require("../../models");

(async () => {
  try {
    await sequelize.authenticate();
    await EtmcTmcActionPointRegister.sync({ alter: false });
    await EtmcTmcActionPointLine.sync({ alter: false });
    console.log("✅  etmc_tmc_action_point_registers / lines – synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
