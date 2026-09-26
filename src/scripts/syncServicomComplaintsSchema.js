/**
 * Align servicom_complaints + comment tables with models.
 *
 *   node src/scripts/syncServicomComplaintsSchema.js
 *   npm run db:sync-servicom-complaints
 */
require("dotenv").config();
const sequelize = require("../config/database");
const ServicomComplaint = require("../models/ServicomComplaint");
const ServicomComplaintComment = require("../models/ServicomComplaintComment");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Syncing servicom_complaints schema (alter)…");
    await ServicomComplaint.sync({ alter: true });
    console.log("Syncing servicom_complaint_comments…");
    await ServicomComplaintComment.sync({ alter: true });

    const [rows] = await sequelize.query("SHOW COLUMNS FROM servicom_complaints");
    const fields = rows.map((r) => r.Field);
    const needed = [
      "complaint_against",
      "complainant_name", "complainant_organization", "complainant_phone", "complainant_nhis_id",
      "complainant_hmo_id", "complainant_hcf_id",
      "respondent_name", "respondent_organization", "respondent_phone", "respondent_nhis_id",
      "respondent_hmo_id", "respondent_hcf_id",
      "created_by_staff_id",
    ];
    const missing = needed.filter((c) => !fields.includes(c));
    if (missing.length) {
      console.error("❌  Still missing:", missing.join(", "));
      process.exit(1);
    }
    console.log(`✅  servicom_complaints OK (${fields.length} columns)`);
    console.log("✅  servicom_complaint_comments ready");
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
