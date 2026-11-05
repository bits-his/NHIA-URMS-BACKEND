/**
 * Create / alter vehicle_maintenance_reports only (approved Vehicle Maintenance pack).
 *
 * Usage: node src/scripts/syncVehicleMaintenanceSchema.js
 */
require("dotenv").config();
const sequelize = require("../config/database");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    // Ensure approved form models (incl. associations) are loaded
    const { VehicleMaintenanceReport } = require("../models");
    if (!VehicleMaintenanceReport) {
      throw new Error(
        'VehicleMaintenanceReport not loaded — check APPROVED_FORMS["vehicle-maintenance"] in activeSchema.js',
      );
    }

    await VehicleMaintenanceReport.sync({ alter: true });
    console.log("✅  synced vehicle_maintenance_reports");

    const [cols] = await sequelize.query("DESCRIBE vehicle_maintenance_reports");
    console.table(cols.map((c) => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key, Default: c.Default })));

    process.exit(0);
  } catch (err) {
    console.error("❌  Vehicle maintenance schema sync failed:", err.message);
    process.exit(1);
  }
})();
