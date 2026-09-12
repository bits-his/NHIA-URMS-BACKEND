/**
 * Create / update HQ Director Enforcement user.
 *
 *   Staff ID: HOD-0003
 *   Access:
 *     - Standards & Quality Assurance › Compliance Management
 *     - SDO (SERVICOM) › Complaints Management
 *
 *   node src/scripts/seedDirectorEnforcement.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
require("../models/index");
const { User } = require("../models/User");
const Department = require("../models/Department");
const Unit = require("../models/Unit");

const STAFF_ID = "HOD-0003";
const PASSWORD = "Nhia@2025";

const functionalities = [
  { access_to: "Dashboard", functionalities: ["Dashboard"] },
  {
    access_to: "Standards & Quality Assurance",
    functionalities: ["Compliance Management"],
  },
  {
    access_to: "SDO",
    functionalities: ["Complaints Management"],
  },
  { access_to: "Notifications", functionalities: ["Notifications"] },
];

(async () => {
  try {
    await sequelize.authenticate();

    const dept = await Department.findOne({ where: { department_code: "AUD" } });
    const unit = await Unit.findOne({ where: { unit_code: "AUD-COMP" } });

    const hashed = await bcrypt.hash(PASSWORD, 12);
    const payload = {
      name: "Director Enforcement",
      email: "hod-0003@nhia.gov.ng",
      password: hashed,
      // National HQ scope so zone/state lookups & nationwide complaint views work
      role: "hq-department",
      zone_id: null,
      state_id: null,
      department_id: dept?.id ?? null,
      unit_id: unit?.id ?? null,
      is_active: true,
      functionalities,
    };

    const existing = await User.findOne({ where: { staff_id: STAFF_ID } });
    if (existing) {
      await existing.update(payload);
      console.log(`✅  Updated ${STAFF_ID} (${existing.name})`);
    } else {
      await User.create({ staff_id: STAFF_ID, ...payload });
      console.log(`✅  Created ${STAFF_ID}`);
    }

    console.log(`
User ready:
  Name:     Director Enforcement
  Staff ID: ${STAFF_ID}
  Password: ${PASSWORD}
  Office:   HQ Department (Audit & Compliance › Compliance & Enforcement)
  Role:     hq-department (national zone/state view)
  Access:
    • Dashboard (Enforcement overview)
    • Compliance Management › Compliance Management
    • SERVICOM › Complaints Management
`);
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  }
})();
