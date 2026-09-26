require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");
const Department = require("../models/Department");
const Unit = require("../models/Unit");
const { DEPARTMENTS } = require("../utils/orgCatalog");
const { logPartial } = require("../utils/seedUtils");

async function seedDepartmentsUnits() {
  let deptCreated = 0;
  let deptSkipped = 0;
  let unitCreated = 0;
  let unitSkipped = 0;

  for (const dept of DEPARTMENTS) {
    const { units, ...deptData } = dept;
    const payload = {
      department_code: deptData.department_code,
      name: deptData.name,
      description: deptData.description,
    };

    const [deptRecord, deptWasCreated] = await Department.findOrCreate({
      where: { department_code: dept.department_code },
      defaults: payload,
    });
    if (deptWasCreated) deptCreated++;
    else {
      await deptRecord.update(payload);
      deptSkipped++;
    }

    for (const unit of units) {
      const unitPayload = {
        unit_code: unit.unit_code,
        name: unit.name,
        description: unit.description,
        department_id: deptRecord.id,
      };
      const [unitRecord, unitWasCreated] = await Unit.findOrCreate({
        where: { unit_code: unit.unit_code },
        defaults: unitPayload,
      });
      if (unitWasCreated) unitCreated++;
      else {
        await unitRecord.update(unitPayload);
        unitSkipped++;
      }
    }

    console.log(`  ✔  ${dept.name} (${units.length} units)`);
  }

  logPartial("Departments", deptCreated, deptSkipped);
  logPartial("Units", unitCreated, unitSkipped);
}

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      console.log("✅  DB connected");
      await seedDepartmentsUnits();
      console.log("\n🎉  Seed complete!");
      process.exit(0);
    } catch (err) {
      console.error("❌  Seed failed:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = { seedDepartmentsUnits };
