/**
 * Migration script: Create Ad-hoc / Special Assignment tables.
 * - adhoc_master_assignments
 * - adhoc_state_assignments
 * - adhoc_state_reports
 *
 * Run: node src/scripts/migrations/createAdhocSpecialAssignmentTables.js
 */
require("dotenv").config();
const sequelize = require("../../config/database");
const AdhocMasterAssignment = require("../../models/adhoc/AdhocMasterAssignment");
const AdhocStateAssignment = require("../../models/adhoc/AdhocStateAssignment");
const AdhocStateReport = require("../../models/adhoc/AdhocStateReport");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    // Define associations
    AdhocMasterAssignment.hasMany(AdhocStateAssignment, {
      foreignKey: "master_assignment_id",
      sourceKey: "master_assignment_id",
      as: "state_assignments",
      onDelete: "CASCADE",
    });
    AdhocStateAssignment.belongsTo(AdhocMasterAssignment, {
      foreignKey: "master_assignment_id",
      targetKey: "master_assignment_id",
      as: "master_assignment",
    });

    AdhocStateAssignment.hasMany(AdhocStateReport, {
      foreignKey: "state_assignment_id",
      sourceKey: "state_assignment_id",
      as: "reports",
      onDelete: "CASCADE",
    });
    AdhocStateReport.belongsTo(AdhocStateAssignment, {
      foreignKey: "state_assignment_id",
      targetKey: "state_assignment_id",
      as: "state_assignment",
    });

    await AdhocMasterAssignment.sync({ alter: true });
    console.log("✔ adhoc_master_assignments created/updated.");

    await AdhocStateAssignment.sync({ alter: true });
    console.log("✔ adhoc_state_assignments created/updated.");

    await AdhocStateReport.sync({ alter: true });
    console.log("✔ adhoc_state_reports created/updated.");

    console.log("All Ad-hoc / Special Assignment tables ready!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();
