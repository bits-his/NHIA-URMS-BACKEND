require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
require("../models/index");
const { User } = require("../models/User");
const Department = require("../models/Department");
const Unit = require("../models/Unit");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    // Find Finance department
    const financeDept = await Department.findOne({ where: { department_code: "FIN" } });
    if (!financeDept) {
      console.error("❌  Finance department not found. Run seedDepartmentsUnits.js first.");
      process.exit(1);
    }

    // Find Revenue unit
    const revenueUnit = await Unit.findOne({ where: { unit_code: "FIN-REV" } });

    const hashedPassword = await bcrypt.hash("password123", 10);

    // Create department officer
    const [deptOfficer, created] = await User.upsert({
      name: "Finance Department Officer",
      staff_id: "DO-0001",
      email: "do@nhia.gov.ng",
      password: hashedPassword,
      role: "department-officer",
      department_id: financeDept.id,
      unit_id: revenueUnit?.id || null,
      is_active: true,
      functionalities: [
        {
          access_to: "Dashboard",
          functionalities: ["Dashboard"]
        },
        {
          access_to: "Finance & Admin Dept",
          functionalities: ["Monthly Report"]
        }
      ]
    });

    if (created) {
      console.log("✅  Department Officer created:");
      console.log(`   Staff ID: DO-0001`);
      console.log(`   Password: password123`);
      console.log(`   Department: ${financeDept.name}`);
      console.log(`   Unit: ${revenueUnit?.name || "None"}`);
    } else {
      console.log("✅  Department Officer updated");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
