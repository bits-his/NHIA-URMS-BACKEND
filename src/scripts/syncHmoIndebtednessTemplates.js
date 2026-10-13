/**
 * Create tables for HMO Indebtedness Templates 2A–2C + Template 3.
 * Usage: node src/scripts/syncHmoIndebtednessTemplates.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const models = require("../models");

async function main() {
  const order = [
    models.StateOfficeHmoReconSheet,
    models.StateOfficeHmoReconLine,
    models.StateOfficeHmoMasterSheet,
    models.StateOfficeHmoMasterLine,
  ];
  for (const Model of order) {
    await Model.sync();
    console.log(`✔  ${Model.tableName}`);
  }
  await sequelize.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
