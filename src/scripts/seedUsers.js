/**
 * Seed demo users for the monthly-report workflow.
 *
 * Workflow:
 *   department-officer  → fills their department's monthly report (Finance / Programmes / SQA)
 *   state-coordinator   → fills any section + reviews state submissions → zonal
 *   zonal-coordinator   → reviews state-approved reports → SDO
 *   sdo                 → final approval
 *
 * Prerequisites:
 *   node src/scripts/migrateRoles.js
 *   node src/scripts/seedDepartmentsUnits.js   (optional — for department_id on users)
 *   Zones/states loaded (seed_data.sql or seedZonesStates.js)
 *
 * Run:
 *   node src/scripts/seedUsers.js
 *
 * Default password for all seeded users: Nhia@2025
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
require("../models/index");
const { User } = require("../models/User");
const ZonalOffice = require("../models/ZonalOffice");
const StateOffice = require("../models/StateOffice");
const Department = require("../models/Department");
const Unit = require("../models/Unit");
const { seedDefaultRoles } = require("../utils/roleService");

const LEGACY_STAFF_IDS = [
  "SC-LAGOS", "DO-FIN-LAGOS", "DO-PROG-LAGOS", "DO-SQA-LAGOS",
  "SC-ONDO", "DO-FIN-ONDO", "DO-PROG-ONDO", "DO-SQA-ONDO",
  "SC-KANO", "DO-FIN-KANO", "DO-PROG-KANO", "DO-SQA-KANO",
];

function staffEmail(staffId) {
  return `${staffId.toLowerCase()}@nhia.gov.ng`;
}

const DEMO_PASSWORD = "Nhia@2025";

// ─── Privilege templates (match src/access/moduleConfig.ts titles) ───────────

const dashboard = [{ access_to: "Dashboard", functionalities: ["Dashboard"] }];
const annual = [{ access_to: "Annual Reports", functionalities: ["Annual Report"] }];
const notifications = [{ access_to: "Notifications", functionalities: ["Notifications"] }];

const financeMonthly = [{
  access_to: "Finance & Admin Dept",
  functionalities: ["Monthly Report"],
}];

const programmesMonthly = [{
  access_to: "Programmes",
  functionalities: ["Monthly Report"],
}];

const sqaMonthly = [{
  access_to: "Standards & Quality Assurance",
  functionalities: ["Monthly Report"],
}];

/** All monthly report modules a state coordinator oversees */
const allMonthlyModules = [
  ...dashboard,
  ...annual,
  ...financeMonthly,
  ...programmesMonthly,
  ...sqaMonthly,
  ...notifications,
];

const zonalCoordinatorAccess = [
  ...dashboard,
  ...annual,
  ...notifications,
];

const sdoAccess = [
  ...dashboard,
  ...annual,
  { access_to: "SDO", functionalities: ["Stock Verification", "My Verifications", "Asset Register"] },
  ...notifications,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Stable staff_id suffix from state row (works with SO-XX and JIG/OND codes). */
function stateSuffix(state) {
  if (state.code && !/^SO-\d+$/i.test(state.code)) {
    return String(state.code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  }
  const base = String(state.description)
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 12) || `ST${state.id}`;
}

async function removeLegacyPilotUsers() {
  const removed = await User.destroy({ where: { staff_id: LEGACY_STAFF_IDS } });
  if (removed) console.log(`ℹ️   Removed ${removed} legacy pilot user(s)\n`);
}

async function upsertUser(spec) {
  const hashed = await bcrypt.hash(spec.password || DEMO_PASSWORD, 12);
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

  const existing = await User.findOne({ where: { staff_id: spec.staff_id } });
  if (existing) {
    await existing.update(payload);
    return { user: existing, created: false };
  }

  const user = await User.create({ staff_id: spec.staff_id, ...payload });
  return { user, created: true };
}

// ─── User definitions ────────────────────────────────────────────────────────

async function buildUserSpecs(deptMap, unitMap) {
  const states = await StateOffice.findAll({
    order: [["description", "ASC"]],
    include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "zonal_code", "description"] }],
  });

  if (!states.length) {
    throw new Error("No states found. Load zones/states first (seed_data.sql or seedZonesStates.js).");
  }

  const specs = [];
  const usedSuffixes = new Map();

  // ── National SDO ──
  specs.push({
    staff_id: "SDO-0001",
    name: "National SDO",
    email: staffEmail("SDO-0001"),
    role: "sdo",
    functionalities: sdoAccess,
  });

  // ── Zonal coordinators (one per zone in DB) ──
  const zones = await ZonalOffice.findAll({ order: [["id", "ASC"]] });
  zones.forEach((zone, i) => {
    const staff_id = `ZC-${String(i + 1).padStart(4, "0")}`;
    specs.push({
      staff_id,
      name: `${zone.description} Coordinator`,
      email: staffEmail(staff_id),
      role: "zonal-coordinator",
      zone_id: zone.id,
      functionalities: zonalCoordinatorAccess,
    });
  });

  // ── Every state: coordinator + finance / programmes / SQA officers ──
  for (const state of states) {
    let suffix = stateSuffix(state);
    if (usedSuffixes.has(suffix)) {
      suffix = `${suffix}-${state.id}`;
    }
    usedSuffixes.set(suffix, true);

    const label = state.description.replace(/\([^)]*\)/g, "").trim();
    const zoneId = state.zonal_id || state.zone?.id || null;

    const scId = `SC-${suffix}`;
    const finId = `DO-FIN-${suffix}`;
    const progId = `DO-PROG-${suffix}`;
    const sqaId = `DO-SQA-${suffix}`;

    specs.push({
      staff_id: scId,
      name: `${label} State Coordinator`,
      email: staffEmail(scId),
      role: "state-coordinator",
      zone_id: zoneId,
      state_id: state.id,
      state_label: label,
      functionalities: allMonthlyModules,
    });

    specs.push({
      staff_id: finId,
      name: `${label} Finance Officer`,
      email: staffEmail(finId),
      role: "department-officer",
      zone_id: zoneId,
      state_id: state.id,
      state_label: label,
      department_id: deptMap.FIN || null,
      unit_id: unitMap["FIN-REV"] || null,
      functionalities: [...dashboard, ...financeMonthly, ...notifications],
    });

    specs.push({
      staff_id: progId,
      name: `${label} Programmes Officer`,
      email: staffEmail(progId),
      role: "department-officer",
      zone_id: zoneId,
      state_id: state.id,
      state_label: label,
      department_id: deptMap.HI || null,
      unit_id: unitMap["HI-ENR"] || null,
      functionalities: [...dashboard, ...programmesMonthly, ...notifications],
    });

    specs.push({
      staff_id: sqaId,
      name: `${label} SQA Officer`,
      email: staffEmail(sqaId),
      role: "department-officer",
      zone_id: zoneId,
      state_id: state.id,
      state_label: label,
      department_id: deptMap.HI || null,
      unit_id: unitMap["HI-QA"] || null,
      functionalities: [...dashboard, ...sqaMonthly, ...notifications],
    });
  }

  return specs;
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected\n");

    await seedDefaultRoles();
    console.log("✅  Roles synced (department-officer can now submit monthly reports)\n");

    await removeLegacyPilotUsers();

    const departments = await Department.findAll();
    const deptMap = Object.fromEntries(departments.map((d) => [d.department_code, d.id]));

    const units = await Unit.findAll();
    const unitMap = Object.fromEntries(units.map((u) => [u.unit_code, u.id]));

    const specs = await buildUserSpecs(deptMap, unitMap);
    let created = 0;
    let updated = 0;

    const nationalAndZonal = specs.filter((s) => !s.state_id);
    const stateUsers = specs.filter((s) => s.state_id);

    console.log("Seeding national & zonal users…\n");
    console.log(
      `${"Staff ID".padEnd(18)} ${"Role".padEnd(22)} ${"State / Zone".padEnd(24)} Email`
    );
    console.log("-".repeat(90));

    for (const spec of nationalAndZonal) {
      const { created: isNew } = await upsertUser(spec);
      if (isNew) created++;
      else updated++;

      let location = "National";
      if (spec.zone_id) {
        const z = await ZonalOffice.findByPk(spec.zone_id, { attributes: ["description"] });
        location = z?.description || `zone #${spec.zone_id}`;
      }

      console.log(
        `${spec.staff_id.padEnd(18)} ${spec.role.padEnd(22)} ${location.padEnd(24)} ${spec.email || ""}`
      );
    }

    console.log(`\nSeeding ${stateUsers.length / 4} states (4 users each)…\n`);
    console.log(
      `${"State".padEnd(22)} ${"Coordinator".padEnd(18)} Finance / Programmes / SQA`
    );
    console.log("-".repeat(90));

    const byState = new Map();
    for (const spec of stateUsers) {
      if (!byState.has(spec.state_id)) byState.set(spec.state_id, { label: spec.state_label, users: [] });
      byState.get(spec.state_id).users.push(spec);
    }

    for (const [, { label, users }] of byState) {
      for (const spec of users) {
        const { created: isNew } = await upsertUser(spec);
        if (isNew) created++;
        else updated++;
      }

      const sc = users.find((u) => u.role === "state-coordinator");
      const fin = users.find((u) => u.staff_id.startsWith("DO-FIN-"));
      const prog = users.find((u) => u.staff_id.startsWith("DO-PROG-"));
      const sqa = users.find((u) => u.staff_id.startsWith("DO-SQA-"));

      console.log(
        `${label.padEnd(22)} ${(sc?.staff_id || "").padEnd(18)} ${fin?.staff_id}, ${prog?.staff_id}, ${sqa?.staff_id}`
      );
    }

    console.log("\n" + "=".repeat(90));
    console.log(`✅  Done — ${created} created, ${updated} updated (${specs.length} total users)`);
    console.log(`🔑  Password for all seeded users: ${DEMO_PASSWORD}`);
    console.log("\nHow to use:");
    console.log("  • DO-FIN-*     → Finance & Admin monthly report only");
    console.log("  • DO-PROG-*    → Programmes (enrolment + outreach) monthly only");
    console.log("  • DO-SQA-*     → SQA (QA + complaints) monthly only");
    console.log("  • SC-*         → All sections + approve at state level");
    console.log("  • ZC-*         → Review reports for their zone");
    console.log("  • SDO-0001     → Final national approval");
    console.log("\nApproval chain: submitted → SC → ZC → SDO → approved");

    process.exit(0);
  } catch (err) {
    const detail = err.errors?.map((e) => e.message).join("; ") || err.message;
    console.error("❌  Seed failed:", detail);
    process.exit(1);
  }
})();
