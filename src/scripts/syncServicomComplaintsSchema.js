/**
 * Align servicom_complaints columns with the ServicomComplaint model
 * (adds missing fields like complaint_against, party name/phone/HMO/HCF ids, etc.).
 *
 * Safe / idempotent — only adds missing columns via Sequelize alter.
 *
 *   node src/scripts/syncServicomComplaintsSchema.js
 *   npm run db:sync-servicom-complaints
 */
require("dotenv").config();
const sequelize = require("../config/database");
const ServicomComplaint = require("../models/ServicomComplaint");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Syncing servicom_complaints schema (alter)…");
    await ServicomComplaint.sync({ alter: true });

    const [rows] = await sequelize.query("SHOW COLUMNS FROM servicom_complaints");
    const fields = rows.map((r) => r.Field);
    const needed = [
      "complaint_against",
      "complainant_name", "complainant_phone", "complainant_nhis_id",
      "complainant_hmo_id", "complainant_hcf_id",
      "respondent_name", "respondent_phone", "respondent_nhis_id",
      "respondent_hmo_id", "respondent_hcf_id",
    ];
    const missing = needed.filter((c) => !fields.includes(c));
    if (missing.length) {
      console.error("❌  Still missing:", missing.join(", "));
      process.exit(1);
    }
    console.log(`✅  servicom_complaints OK (${fields.length} columns) — complaint_against present`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
