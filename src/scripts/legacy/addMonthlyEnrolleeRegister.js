/**
 * Create monthly_enrollee_registers table (SOC/Zones ICT register).
 *
 *   node src/scripts/legacy/addMonthlyEnrolleeRegister.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
const { MonthlyEnrolleeRegister } = require("../../models");

(async () => {
  try {
    await sequelize.authenticate();
    await MonthlyEnrolleeRegister.sync({ alter: false });
    console.log("✅  monthly_enrollee_registers – synced");
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
