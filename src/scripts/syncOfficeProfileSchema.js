/**
 * Sync Office Profile Tables with complete referential integrity.
 * Usage: node backend/src/scripts/syncOfficeProfileSchema.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
const StateZonalOfficeProfile = require("../models/StateZonalOfficeProfile");
const OfficeAccommodation = require("../models/OfficeAccommodation");
const UtilityServiceReport = require("../models/UtilityServiceReport");
const StateZonalFocalPerson = require("../models/StateZonalFocalPerson");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connection OK");

    console.log("Syncing StateZonalOfficeProfile...");
    await StateZonalOfficeProfile.sync({ alter: true });
    console.log("✅ synced state_zonal_office_profiles");

    console.log("Syncing OfficeAccommodation...");
    await OfficeAccommodation.sync({ alter: true });
    console.log("✅ synced office_accommodations");

    console.log("Syncing UtilityServiceReport...");
    await UtilityServiceReport.sync({ alter: true });
    console.log("✅ synced utility_service_reports");

    console.log("Syncing StateZonalFocalPerson...");
    await StateZonalFocalPerson.sync({ alter: true });
    console.log("✅ synced state_zonal_focal_persons");

    console.log("🎉 All Office Profile tables successfully synced with referential integrity!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Sync failed:", err);
    process.exit(1);
  }
})();

