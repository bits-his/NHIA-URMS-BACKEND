/**
 * Seed Head of Unit and State Enforcement Officer accounts based on the SDO PORTAL diagram.
 *
 * Linking Departments & Access Rules:
 *   1. SERVICOM › Complaints Management           → Enforcement / Call Centre
 *   2. Stock Verification › Physical Asset Verify  → Finance / HR
 *   3. Stock Verification › Verification of Supply  → Stores / Procurement
 *   4. Stock Verification › Store Management       → Finance / States
 *   5. State Office Coordination › Action Points   → SOC / Zones
 *   6. State Office Coordination › Escalated Issues → States / Procurement
 *
 * Run:
 *   node src/scripts/seedLinkingDepartmentsHeadOfUnit.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
require("../models/index");
const { User } = require("../models/User");
const Department = require("../models/Department");
const Unit = require("../models/Unit");
const ZonalOffice = require("../models/ZonalOffice");
const StateOffice = require("../models/StateOffice");
const { seedDefaultRoles } = require("../utils/roleService");
const { logPartial } = require("../utils/seedUtils");

const DEFAULT_PASSWORD = "123456";

// ─── Module Privilege Presets ──────────────────────────────────────────────────
const dashboard = [{ access_to: "Dashboard", functionalities: ["Dashboard"] }];
const notifications = [{ access_to: "Notifications", functionalities: ["Notifications"] }];

const servicomComplaints = [
  ...dashboard,
  {
    access_to: "SDO",
    functionalities: ["Complaints Management"],
  },
  {
    access_to: "Standards & Quality Assurance",
    functionalities: ["Compliance Management"],
  },
  ...notifications,
];

const stockAssetVerify = [
  ...dashboard,
  {
    access_to: "SDO",
    functionalities: ["Stock Verification Dashboard", "Physical Asset Verification"],
  },
  {
    access_to: "Finance & Admin Dept",
    functionalities: ["Finance Report", "Admin Report"],
  },
  ...notifications,
];

const stockSupplyVerify = [
  ...dashboard,
  {
    access_to: "SDO",
    functionalities: [
      "Stock Verification Dashboard",
      "Verification of Supply",
      "Prepayment Analysis Register",
    ],
  },
  ...notifications,
];

const storeManagementAccess = [
  ...dashboard,
  {
    access_to: "SDO",
    functionalities: [
      "Stock Verification Dashboard",
      "Inventory Register",
      "Capitalisation & Issuance",
    ],
  },
  {
    access_to: "Finance & Admin Dept",
    functionalities: ["Finance Report"],
  },
  ...notifications,
];

const socActionPointsAccess = [
  ...dashboard,
  {
    access_to: "SOC/Zones",
    functionalities: [
      "SOC/Zones Dashboard",
      "ETMC/TMC Action-Point Register",
      "State/Zonal Office Profile",
      "State/Zonal Focal Persons Register",
    ],
  },
  ...notifications,
];

const socEscalationsAccess = [
  ...dashboard,
  {
    access_to: "SOC/Zones",
    functionalities: ["Weekly Actionable", "Contracted Services"],
  },
  ...notifications,
];

// ─── Helper Functions ──────────────────────────────────────────────────────────
function stateSuffix(state) {
  if (state.code && !/^SO-\d+$/i.test(state.code)) {
    return String(state.code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  }
  const base = String(state.description)
    .replace(/\([^)]*\)/g, "")
    .replace(/State/i, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 12) || `ST${state.id}`;
}

async function getOrCreateDept(code, name, description) {
  let dept = await Department.findOne({ where: { department_code: code } });
  if (!dept) {
    dept = await Department.create({ department_code: code, name, description });
  }
  return dept;
}

async function getOrCreateUnit(code, name, deptId, description = "") {
  let unit = await Unit.findOne({ where: { unit_code: code } });
  if (!unit) {
    unit = await Unit.create({
      unit_code: code,
      name,
      department_id: deptId,
      description,
    });
  }
  return unit;
}

async function upsertUser(spec) {
  const existing = await User.findOne({ where: { staff_id: spec.staff_id } });
  const hashed = await bcrypt.hash(spec.password || DEFAULT_PASSWORD, 12);

  const payload = {
    name: spec.name,
    email: spec.email,
    password: hashed,
    role: spec.role,
    zone_id: spec.zone_id ?? null,
    state_id: spec.state_id ?? null,
    department_id: spec.department_id ?? null,
    unit_id: spec.unit_id ?? null,
    is_active: true,
    functionalities: spec.functionalities,
  };

  if (existing) {
    await existing.update(payload);
    return { user: existing, created: false };
  } else {
    const user = await User.create({ staff_id: spec.staff_id, ...payload });
    return { user, created: true };
  }
}

// ─── Main Execution ───────────────────────────────────────────────────────────
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  Database connected\n");

    // 1. Ensure default system roles exist
    await seedDefaultRoles();
    console.log("✅  Default system roles verified (including 'head-of-unit')\n");

    // 2. Ensure linking departments & units exist
    const enfDept  = await getOrCreateDept("ENF", "Enforcement Department", "Regulatory enforcement and compliance.");
    const afdDept  = await getOrCreateDept("AFD", "Administration & Finance Department", "Financial operations, budgeting and admin.");
    const hrdDept  = await getOrCreateDept("HRD", "Human Resource Department", "HR records, staff welfare and development.");
    const pdDept   = await getOrCreateDept("PD",  "Procurement Department", "Procurement planning and contract administration.");
    const scdDept  = await getOrCreateDept("SCD", "State Coordination Department", "State offices coordination.");
    const ictDept  = await getOrCreateDept("ICT", "Information & Communication Technology Department", "IT infrastructure and call centre.");

    const enfCcUnit  = await getOrCreateUnit("ENF-CC", "Enforcement & Call Centre Unit", enfDept.id);
    const afdAccUnit = await getOrCreateUnit("AFD-ACC", "Finance & Accounts Unit", afdDept.id);
    const afdStoUnit = await getOrCreateUnit("AFD-STO", "Stores & Inventory Unit", afdDept.id);
    const hrdUnit    = await getOrCreateUnit("HRD-GEN", "Human Resources Unit", hrdDept.id);
    const pdUnit     = await getOrCreateUnit("PD-PROC", "Procurement Unit", pdDept.id);
    const scdUnit    = await getOrCreateUnit("SCD-SOC", "State Office Coordination Unit", scdDept.id);

    // Fetch all state offices from database
    const states = await StateOffice.findAll({
      order: [["description", "ASC"]],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "zonal_code", "description"] }],
    });

    const lagosState = states.find((s) => /lagos/i.test(s.description));
    const lagosZoneId = lagosState?.zonal_id || lagosState?.zone?.id || null;

    // 3. HQ Head of Unit Accounts
    const accounts = [
      {
        staff_id: "HOU-0001",
        name: "Head of Unit - Enforcement & Call Centre",
        email: "hou.enforcement@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "head-of-unit",
        linking_target: "SERVICOM -> Complaints Management",
        department_id: enfDept.id,
        dept_name: enfDept.name,
        unit_id: enfCcUnit.id,
        unit_name: enfCcUnit.name,
        functionalities: servicomComplaints,
      },
      {
        staff_id: "HOU-0002",
        name: "Head of Unit - Finance & HR",
        email: "hou.finance@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "head-of-unit",
        linking_target: "Stock Verification -> Physical Asset Verification",
        department_id: afdDept.id,
        dept_name: afdDept.name,
        unit_id: afdAccUnit.id,
        unit_name: afdAccUnit.name,
        functionalities: stockAssetVerify,
      },
      {
        staff_id: "HOU-0003",
        name: "Head of Unit - Stores & Procurement",
        email: "hou.procurement@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "head-of-unit",
        linking_target: "Stock Verification -> Verification of Supply",
        department_id: pdDept.id,
        dept_name: pdDept.name,
        unit_id: pdUnit.id,
        unit_name: pdUnit.name,
        functionalities: stockSupplyVerify,
      },
      {
        staff_id: "HOU-0004",
        name: "Head of Unit - Store Management",
        email: "hou.stores@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "head-of-unit",
        linking_target: "Stock Verification -> Store Management",
        department_id: afdDept.id,
        dept_name: afdDept.name,
        unit_id: afdStoUnit.id,
        unit_name: afdStoUnit.name,
        functionalities: storeManagementAccess,
      },
      {
        staff_id: "HOU-0005",
        name: "Head of Unit - State Office Coordination",
        email: "hou.soc@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "head-of-unit",
        linking_target: "SOC -> ETMC Resolutions / Action Points Register",
        department_id: scdDept.id,
        dept_name: scdDept.name,
        unit_id: scdUnit.id,
        unit_name: scdUnit.name,
        functionalities: socActionPointsAccess,
      },
      {
        staff_id: "HOU-0006",
        name: "Head of Unit - Escalations & State Procurement",
        email: "hou.escalations@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "head-of-unit",
        linking_target: "SOC -> Actions / Escalated Issues",
        department_id: pdDept.id,
        dept_name: pdDept.name,
        unit_id: pdUnit.id,
        unit_name: pdUnit.name,
        functionalities: socEscalationsAccess,
      },
      {
        staff_id: "SO-0001",
        name: "Lagos State Enforcement Officer",
        email: "so.lagos.enf@nhia.gov.ng",
        password: DEFAULT_PASSWORD,
        role: "state-officer",
        linking_target: "State Officer (Lagos) -> Enforcement",
        zone_id: lagosZoneId,
        state_id: lagosState?.id || null,
        department_id: enfDept.id,
        dept_name: enfDept.name,
        unit_id: enfCcUnit.id,
        unit_name: enfCcUnit.name,
        functionalities: servicomComplaints,
      },
    ];

    // 4. Dynamically seed State Enforcement Officers for ALL States in DB
    const usedStaffIds = new Set(accounts.map((a) => a.staff_id));

    for (const state of states) {
      const suffix = stateSuffix(state);
      const staffId = `SO-ENF-${suffix}`;
      const stateLabel = state.description.replace(/\([^)]*\)/g, "").trim();
      const zoneId = state.zonal_id || state.zone?.id || null;

      if (!usedStaffIds.has(staffId)) {
        usedStaffIds.add(staffId);
        accounts.push({
          staff_id: staffId,
          name: `${stateLabel} Enforcement Officer`,
          email: `so.enf.${suffix.toLowerCase()}@nhia.gov.ng`,
          password: DEFAULT_PASSWORD,
          role: "state-officer",
          linking_target: `State Officer (${stateLabel}) -> Enforcement`,
          zone_id: zoneId,
          state_id: state.id,
          department_id: enfDept.id,
          dept_name: enfDept.name,
          unit_id: enfCcUnit.id,
          unit_name: enfCcUnit.name,
          functionalities: servicomComplaints,
        });
      }
    }

    let createdCount = 0;
    let updatedCount = 0;

    console.log("┌" + "─".repeat(110) + "┐");
    console.log(
      `│ ${"Staff ID".padEnd(16)} │ ${"Full Name".padEnd(36)} │ ${"Role".padEnd(15)} │ ${"Department".padEnd(20)} │ ${"Password".padEnd(10)} │`
    );
    console.log("├" + "─".repeat(110) + "┤");

    for (const spec of accounts) {
      const { created } = await upsertUser(spec);
      if (created) createdCount++;
      else updatedCount++;

      console.log(
        `│ ${spec.staff_id.padEnd(16)} │ ${spec.name.slice(0, 36).padEnd(36)} │ ${spec.role.padEnd(15)} │ ${(spec.dept_name || "N/A").slice(0, 20).padEnd(20)} │ ${spec.password.padEnd(10)} │`
      );
    }
    console.log("└" + "─".repeat(110) + "┘\n");

    console.log(`🎉  Seed execution finished: ${createdCount} created, ${updatedCount} updated.`);
    console.log(`Total accounts seeded: ${accounts.length} (${accounts.length - 6} State Enforcement Officers + 6 HQ Head of Units)`);
    console.log(`🔑  Default password for all seeded accounts: ${DEFAULT_PASSWORD}\n`);

    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
