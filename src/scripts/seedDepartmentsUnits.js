require("dotenv").config();
const sequelize  = require("../config/database");
require("../models/index");
const Department = require("../models/Department");
const Unit       = require("../models/Unit");
const { logPartial } = require("../utils/seedUtils");

// ─── NHIA Departments & Units ─────────────────────────────────────────────────
const DEPARTMENTS = [
  {
    department_code: "SQA",
    name: "Standard Quality & Assurance Department",
    description: "Standards, quality assurance, accreditation and compliance monitoring.",
    units: [],
  },
  {
    department_code: "ENF",
    name: "Enforcement Department",
    description: "Regulatory enforcement actions and compliance enforcement.",
    units: [],
  },
  {
    department_code: "ICT",
    name: "Information & Communication Technology Department",
    description: "Information systems, digital infrastructure and IT services.",
    units: [],
  },
  {
    department_code: "AFD",
    name: "Administration & Finance Department",
    description: "Administration, financial operations, budgeting and expenditure.",
    units: [],
  },
  {
    department_code: "HRD",
    name: "Human Resource Department",
    description: "Staff recruitment, welfare, training and HR records management.",
    units: [],
  },
  {
    department_code: "FSD",
    name: "Formal Sector Department",
    description: "Formal sector health insurance schemes and related programmes.",
    units: [],
  },
  {
    department_code: "ISD",
    name: "Informal Sector Department",
    description: "Informal sector health insurance schemes and related programmes.",
    units: [],
  },
  {
    department_code: "PD",
    name: "Procurement Department",
    description: "Procurement planning, tendering and contract administration.",
    units: [],
  },
  {
    department_code: "LSD",
    name: "Legal Service Department",
    description: "Legal advisory, contracts and litigation support.",
    units: [],
  },
  {
    department_code: "PRSD",
    name: "Planning Research & Statistics Department",
    description: "Strategic planning, research, statistics and performance reporting.",
    units: [],
  },
  {
    department_code: "SDO",
    name: "Special Duties Office",
    description: "Coordination of special duties and strategic assignments.",
    units: [],
  },
  {
    department_code: "SPD",
    name: "Special Purchase Department",
    description: "Special purchase programmes and related coordination.",
    units: [],
  },
  {
    department_code: "SCD",
    name: "State Coordination Department",
    description: "Coordination of state offices and related field operations.",
    units: [],
  },
  {
    department_code: "VGFD",
    name: "Vulnerable Groups Fund Department",
    description: "Vulnerable groups fund programmes and beneficiary management.",
    units: [],
  },
  {
    department_code: "IPD",
    name: "Investment Promotion Department",
    description: "Investment promotion and related partnership initiatives.",
    units: [],
  },
  {
    department_code: "IAD",
    name: "Internal Audit Department",
    description: "Internal audit, risk assurance and control reviews.",
    units: [],
  },
  {
    department_code: "CCD",
    name: "Corporate Communications Department",
    description: "Corporate communications, media relations and public affairs.",
    units: [],
  },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    let deptCreated = 0;
    let deptSkipped = 0;
    let unitCreated = 0;
    let unitSkipped = 0;

    for (const dept of DEPARTMENTS) {
      const { units, ...deptData } = dept;

      const [deptRecord, deptWasCreated] = await Department.findOrCreate({
        where: { department_code: dept.department_code },
        defaults: deptData,
      });

      if (deptWasCreated) {
        deptCreated++;
      } else {
        // Keep existing codes in sync with the official names/descriptions
        await deptRecord.update({
          name: deptData.name,
          description: deptData.description,
        });
        deptSkipped++;
      }

      const deptId = deptRecord.id;

      for (const unit of units) {
        const [, unitWasCreated] = await Unit.findOrCreate({
          where: { unit_code: unit.unit_code },
          defaults: { ...unit, department_id: deptId },
        });
        if (unitWasCreated) unitCreated++;
        else unitSkipped++;
      }

      console.log(`  ✔  ${dept.department_code} — ${dept.name}`);
    }

    logPartial("Departments", deptCreated, deptSkipped);
    logPartial("Units", unitCreated, unitSkipped);
    console.log("\n🎉  Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
