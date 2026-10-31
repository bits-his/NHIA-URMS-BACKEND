/**
 * Production User Reset & Sync Utility.
 *
 * Requirements:
 * 1. Strictly protects 'admin' (id: 1, staff_id: 'ADMIN001').
 * 2. Deletes all legacy/non-admin users in the database.
 * 3. Creates the 16 canonical designated official accounts from DOCUMENT_USER_PROFILES.
 * 4. Regenerates the production credentials directory PDF.
 *
 * Usage:
 *   Dry run preview:  node src/scripts/resetProductionUsers.js
 *   Apply changes:    node src/scripts/resetProductionUsers.js --confirm
 *   NPM shortcut:     npm run db:reset-prod-users -- --confirm
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { User, Role, Department, StateOffice, ZonalOffice } = require("../models");
const { DEFAULT_ROLES } = require("../utils/roleService");
const { DOCUMENT_USER_PROFILES } = require("../utils/documentUserProfiles");
const { generateUsersPdf, PRODUCTION_ACCOUNTS } = require("./generateUsersPdf");
const path = require("path");

const publicAttributes = [
  "id",
  "staff_id",
  "name",
  "email",
  "role",
  "is_active",
  "state_code",
  "zonal_code",
  "department_code",
];

async function resetProductionUsers({ confirm = false } = {}) {
  console.log("================================================================================");
  console.log("  NHIA URMS — PRODUCTION USER RESET & SYNC UTILITY");
  console.log("================================================================================");
  console.log(`Database: ${sequelize.config.database} on ${sequelize.config.host || "localhost"}`);
  console.log(`Execution Mode: ${confirm ? "⚠️  APPLY / EXECUTE" : "🔍 DRY-RUN PREVIEW"}`);
  console.log("--------------------------------------------------------------------------------");

  // 1. Fetch current users
  const currentUsers = await User.findAll({
    attributes: publicAttributes,
    order: [["id", "ASC"]],
    raw: true,
  });

  const adminUsers = currentUsers.filter((u) => u.role === "admin" || u.id === 1);
  const usersToDelete = currentUsers.filter((u) => u.role !== "admin" && u.id !== 1);

  console.log(`\n1. ACCOUNTS TO PRESERVE (ADMINISTRATOR):`);
  console.table(adminUsers);

  console.log(`\n2. ACCOUNTS TO REMOVE (${usersToDelete.length} users):`);
  if (usersToDelete.length > 0) {
    console.table(
      usersToDelete.map((u) => ({
        id: u.id,
        staff_id: u.staff_id,
        name: u.name,
        role: u.role,
        dept: u.department_code,
      }))
    );
  } else {
    console.log("   (No non-admin users found to delete.)");
  }

  console.log(`\n3. CANONICAL OFFICIAL ROSTER TO BE CREATED (${DOCUMENT_USER_PROFILES.length} accounts):`);
  console.table(
    DOCUMENT_USER_PROFILES.map((p) => {
      const cred = PRODUCTION_ACCOUNTS.find((a) => a.staff_id === p.staff_id);
      return {
        staff_id: p.staff_id,
        name: p.name,
        role: p.role,
        scope: p.report_scope,
        dept: p.department_code,
        initial_password: cred?.password || "Nhia@2026!" + p.staff_id.replace("-", ""),
      };
    })
  );

  if (!confirm) {
    console.log("\n================================================================================");
    console.log("  [DRY-RUN COMPLETE] No changes were made to the database.");
    console.log("  To execute this reset on production, run with the --confirm flag:");
    console.log("    node src/scripts/resetProductionUsers.js --confirm");
    console.log("    or: npm run db:reset-prod-users -- --confirm");
    console.log("================================================================================");
    return;
  }

  // 2. Execute within atomic transaction
  console.log("\n⏳ Beginning atomic transaction to reset users...");

  await sequelize.transaction(async (transaction) => {
    // Disable foreign key checks temporarily for atomic identity swap
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;", { transaction });

    // A. Verify and update default roles
    for (const spec of DOCUMENT_USER_PROFILES) {
      const def = DEFAULT_ROLES.find((r) => r.key === spec.role);
      if (def) {
        const [roleRec] = await Role.findOrCreate({
          where: { key: spec.role },
          defaults: { ...def, is_active: true },
          transaction,
        });
        await roleRec.update({ ...def, is_active: true }, { transaction });
      }
    }

    // B. Delete all non-admin users
    const deleteIds = usersToDelete.map((u) => u.id);
    let deletedCount = 0;
    if (deleteIds.length > 0) {
      deletedCount = await User.destroy({
        where: {
          id: { [Op.in]: deleteIds },
          role: { [Op.ne]: "admin" },
        },
        transaction,
      });
      console.log(`   Deleted ${deletedCount} non-admin accounts.`);
    }

    // C. Create official canonical accounts
    for (const spec of DOCUMENT_USER_PROFILES) {
      const cred = PRODUCTION_ACCOUNTS.find((a) => a.staff_id === spec.staff_id);
      const rawPassword = cred?.password || `Nhia@2026!${spec.staff_id.replace(/[^a-zA-Z0-9]/g, "")}`;
      const hashedPassword = await bcrypt.hash(rawPassword, 12);

      const stateCode = spec.report_scope === "state" ? "KAN" : null;
      const zonalCode = ["state", "zonal"].includes(spec.report_scope) ? "NW" : null;
      const officialEmail = cred?.email || `${spec.staff_id.toLowerCase()}@nhia.gov.ng`;

      // Check if user already exists
      const existing = await User.findOne({
        where: { staff_id: spec.staff_id },
        transaction,
      });

      if (existing) {
        await existing.update(
          {
            name: spec.name,
            role: spec.role,
            email: officialEmail,
            password: hashedPassword,
            department_code: spec.department_code,
            state_code: stateCode,
            zonal_code: zonalCode,
            is_active: true,
            functionalities: structuredClone(spec.access),
          },
          { transaction }
        );
      } else {
        await User.create(
          {
            staff_id: spec.staff_id,
            name: spec.name,
            role: spec.role,
            email: officialEmail,
            password: hashedPassword,
            department_code: spec.department_code,
            state_code: stateCode,
            zonal_code: zonalCode,
            is_active: true,
            functionalities: structuredClone(spec.access),
          },
          { transaction }
        );
      }
    }

    // D. Re-enable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;", { transaction });

    // E. Verify admin account safety
    const adminAfter = await User.findOne({
      where: { role: "admin" },
      transaction,
    });
    if (!adminAfter) {
      throw new Error("FATAL: Admin account was compromised during transaction! Rolling back.");
    }

    console.log("   Canonical accounts created & synchronized successfully.");
  });

  // 3. Generate updated credentials PDF
  const storagePdf = path.resolve(__dirname, "../../storage/credentials/NHIA_Production_User_Credentials.pdf");
  const artifactPdf = path.resolve("/Users/admin/.gemini/antigravity/brain/f7ebd5d6-da8f-4ed1-a038-abe6b9140fc3/NHIA_Production_User_Credentials.pdf");

  generateUsersPdf(storagePdf);
  generateUsersPdf(artifactPdf);

  console.log("\n================================================================================");
  console.log("🎉 PRODUCTION USER RESET COMPLETED SUCCESSFULLY!");
  console.log("   - Admin account (ADMIN001) was preserved untouched.");
  console.log(`   - 16 canonical production accounts are active and ready.`);
  console.log(`   - Credentials PDF generated at:\n     ${storagePdf}`);
  console.log("================================================================================");
}

if (require.main === module) {
  const confirm = process.argv.includes("--confirm") || process.argv.includes("--apply");
  resetProductionUsers({ confirm })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ User reset failed:", err);
      process.exit(1);
    });
}

module.exports = { resetProductionUsers };
