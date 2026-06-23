/**
 * Migration: add department_id and unit_id to users table
 * Run: node src/scripts/addUserColumns.js
 */
const sequelize = require("../config/database");

async function run() {
  const qi = sequelize.getQueryInterface();

  try {
    await qi.addColumn("users", "department_id", {
      type: require("sequelize").DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "departments", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      after: "state_id",
    });
    console.log("✅  Added department_id");
  } catch (e) {
    if (e.original?.code === "ER_DUP_FIELDNAME") {
      console.log("⏭   department_id already exists, skipping");
    } else throw e;
  }

  try {
    await qi.addColumn("users", "unit_id", {
      type: require("sequelize").DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "units", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      after: "department_id",
    });
    console.log("✅  Added unit_id");
  } catch (e) {
    if (e.original?.code === "ER_DUP_FIELDNAME") {
      console.log("⏭   unit_id already exists, skipping");
    } else throw e;
  }

  await sequelize.close();
  console.log("Done.");
}

run().catch(err => { console.error(err); process.exit(1); });
