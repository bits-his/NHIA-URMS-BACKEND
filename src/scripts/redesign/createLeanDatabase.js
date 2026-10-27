/**
 * Create a LEAN database with only tables needed for the redesigned platform.
 *
 * Includes:
 *   - Org spine: zonal_offices, state_offices, departments, units, users, roles
 *   - Notifications: app_notifications
 *   - Provider refs (shared lookups): hmo_providers, hcf_facilities, nhia_accredited_providers
 *   - All redesign platform tables (lookups, forms, workflow, dims, facts)
 *
 * Does NOT copy legacy *_reports / SERVICOM / store / stock / monthly HQ tables.
 *
 * Usage:
 *   node src/scripts/redesign/createLeanDatabase.js
 *   node src/scripts/redesign/createLeanDatabase.js --db=nhia_urms_v2
 *   node src/scripts/redesign/createLeanDatabase.js --db=nhia_urms_v2 --drop-first
 *
 * After success, point .env DB_NAME at the new DB only when you are ready
 * to run platform-only work — the full legacy UI will not work on this DB.
 */
require("dotenv").config();
const mysql = require("mysql2/promise");
const { Sequelize } = require("sequelize");
const path = require("path");

const args = process.argv.slice(2);
const dropFirst = args.includes("--drop-first");
const dbArg = args.find((a) => a.startsWith("--db="));
const TARGET_DB = dbArg ? dbArg.split("=")[1] : "nhia_urms_v2";
const SOURCE_DB = process.env.DB_NAME || "nhia_db";

const HOST = process.env.DB_HOST || "localhost";
const PORT = Number(process.env.DB_PORT) || 3306;
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASSWORD || "";

const ORG_TABLES = [
  "zonal_offices",
  "state_offices",
  "departments",
  "units",
  "roles",
  "users",
];

const REF_TABLES = [
  "app_notifications",
  "hmo_providers",
  "hcf_facilities",
  "nhia_accredited_providers",
];

async function createDatabase() {
  const conn = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    multipleStatements: true,
  });

  if (dropFirst) {
    console.log(`⚠️  DROP DATABASE IF EXISTS \`${TARGET_DB}\``);
    await conn.query(`DROP DATABASE IF EXISTS \`${TARGET_DB}\``);
  }

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  console.log(`✅  Database ready: ${TARGET_DB}`);
  await conn.end();
}

function makeSequelize(database) {
  return new Sequelize({
    dialect: "mysql",
    host: HOST,
    port: PORT,
    database,
    username: USER,
    password: PASSWORD,
    logging: false,
    define: { timestamps: true, underscored: true },
  });
}

async function syncLeanSchema(targetSequelize) {
  // Temporarily point the shared sequelize singleton at the target DB by
  // requiring models against a patched module — simpler: use raw sync via
  // re-requiring with env override is messy. Instead sync via QueryInterface
  // by loading models with a custom sequelize inject.

  // Patch: set process env and clear require cache for database + models
  process.env.DB_NAME = TARGET_DB;

  const dbPath = path.resolve(__dirname, "../../config/database.js");
  const modelsIndex = path.resolve(__dirname, "../../models/index.js");
  const redesignIndex = path.resolve(__dirname, "../../models/redesign/index.js");
  const appNotif = path.resolve(__dirname, "../../models/AppNotification.js");
  const hmo = path.resolve(__dirname, "../../models/HmoProvider.js");
  const hcf = path.resolve(__dirname, "../../models/HcfFacility.js");
  const nhia = path.resolve(__dirname, "../../models/NhiaAccreditedProvider.js");

  // Clear caches so models bind to TARGET_DB sequelize instance
  for (const p of [
    dbPath,
    modelsIndex,
    redesignIndex,
    appNotif,
    hmo,
    hcf,
    nhia,
    path.resolve(__dirname, "../../models/ZonalOffice.js"),
    path.resolve(__dirname, "../../models/StateOffice.js"),
    path.resolve(__dirname, "../../models/Department.js"),
    path.resolve(__dirname, "../../models/Unit.js"),
    path.resolve(__dirname, "../../models/User.js"),
    path.resolve(__dirname, "../../models/Role.js"),
  ]) {
    delete require.cache[p];
  }
  // Also clear all redesign model files
  const fs = require("fs");
  const redesignDir = path.resolve(__dirname, "../../models/redesign");
  for (const f of fs.readdirSync(redesignDir)) {
    delete require.cache[path.join(redesignDir, f)];
  }

  const sequelize = require("../../config/database");
  // Authenticate against target
  await sequelize.authenticate();
  console.log(`✅  Connected to ${TARGET_DB}`);

  // Org models only (not full index — that registers 100+ models)
  const ZonalOffice = require("../../models/ZonalOffice");
  const StateOffice = require("../../models/StateOffice");
  const Department = require("../../models/Department");
  const Unit = require("../../models/Unit");
  const { User } = require("../../models/User");
  const Role = require("../../models/Role");
  const AppNotification = require("../../models/AppNotification");
  const HmoProvider = require("../../models/HmoProvider");
  const HcfFacility = require("../../models/HcfFacility");
  const NhiaAccreditedProvider = require("../../models/NhiaAccreditedProvider");

  // Minimal associations for FK order
  ZonalOffice.hasMany(StateOffice, { foreignKey: "zonal_code", sourceKey: "zonal_code" });
  StateOffice.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code" });
  Department.hasMany(Unit, { foreignKey: "department_code", sourceKey: "department_code" });
  Unit.belongsTo(Department, { foreignKey: "department_code", targetKey: "department_code" });

  const orgModels = [
    ZonalOffice,
    StateOffice,
    Department,
    Unit,
    Role,
    User,
    AppNotification,
    HmoProvider,
    HcfFacility,
    NhiaAccreditedProvider,
  ];

  for (const m of orgModels) {
    await m.sync({ force: false, alter: true });
    console.log(`  synced ${m.tableName}`);
  }

  const redesign = require("../../models/redesign");
  for (const m of Object.values(redesign)) {
    await m.sync({ force: false, alter: true });
    console.log(`  synced ${m.tableName}`);
  }

  // Dedicated per-form Provider Management tables (+ shared status audit)
  delete require.cache[path.resolve(__dirname, "../../models/providerManagement/index.js")];
  delete require.cache[path.resolve(__dirname, "../../models/providerManagement/makeProviderReportModels.js")];
  delete require.cache[path.resolve(__dirname, "../../models/ReportStatusEvent.js")];
  const { PROVIDER_REPORT_PACKS } = require("../../models/providerManagement");
  const ReportStatusEvent = require("../../models/ReportStatusEvent");
  for (const { Report, Line } of PROVIDER_REPORT_PACKS) {
    await Report.sync({ force: false, alter: true });
    await Line.sync({ force: false, alter: true });
    console.log(`  synced ${Report.tableName} + ${Line.tableName}`);
  }
  await ReportStatusEvent.sync({ force: false, alter: true });
  console.log("  synced report_status_events");

  // Core dedicated SO forms (inspectable — not shared EAV)
  const EnrolmentReport = require("../../models/EnrolmentReport");
  const EnrolmentReportLine = require("../../models/EnrolmentReportLine");
  await EnrolmentReport.sync({ force: false, alter: true });
  await EnrolmentReportLine.sync({ force: false, alter: true });
  console.log("  synced enrolment_reports + lines");

  return sequelize;
}

async function copyTable(sourceConn, targetConn, table) {
  const [[{ c }]] = await sourceConn.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [SOURCE_DB, table],
  );
  if (!c) {
    console.log(`  skip ${table} (missing in source)`);
    return;
  }

  // Ensure target table exists (already synced). Truncate then copy.
  await targetConn.query(`SET FOREIGN_KEY_CHECKS=0`);
  await targetConn.query(`TRUNCATE TABLE \`${table}\``);

  const [rows] = await sourceConn.query(`SELECT * FROM \`${SOURCE_DB}\`.\`${table}\``);
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    await targetConn.query(`SET FOREIGN_KEY_CHECKS=1`);
    return;
  }

  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => "?").join(",");
  const colList = cols.map((c) => `\`${c}\``).join(",");
  const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`;

  const batch = 200;
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    for (const row of slice) {
      await targetConn.query(sql, cols.map((c) => row[c]));
    }
  }
  await targetConn.query(`SET FOREIGN_KEY_CHECKS=1`);
  console.log(`  ${table}: ${rows.length} rows copied`);
}

async function copyOrgAndRefs() {
  const sourceConn = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: SOURCE_DB,
  });
  const targetConn = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: TARGET_DB,
  });

  console.log(`\nCopying org/ref data ${SOURCE_DB} → ${TARGET_DB}`);
  for (const t of [...ORG_TABLES, ...REF_TABLES]) {
    await copyTable(sourceConn, targetConn, t);
  }

  await sourceConn.end();
  await targetConn.end();
}

async function countTables(database) {
  const conn = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
  });
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [database],
  );
  const [names] = await conn.query(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
    [database],
  );
  await conn.end();
  return { count: rows[0].c, names: names.map((r) => r.name) };
}

(async () => {
  try {
    if (TARGET_DB === SOURCE_DB) {
      console.error("❌  Refusing to rebuild the same DB as source. Use --db=nhia_urms_v2");
      process.exit(1);
    }

    console.log(`Source (untouched): ${SOURCE_DB}`);
    console.log(`Target (lean):      ${TARGET_DB}`);
    console.log(`drop-first:         ${dropFirst}`);

    await createDatabase();
    await syncLeanSchema();
    await copyOrgAndRefs();

    // Seed redesign metadata into TARGET (DB_NAME already set)
    console.log("\nSeeding redesign core into lean DB…");
    delete require.cache[path.resolve(__dirname, "./seedRedesignCore.js")];
    // seedRedesignCore self-exits — spawn instead
    const { spawnSync } = require("child_process");
    const seed = spawnSync(
      process.execPath,
      [path.resolve(__dirname, "seedRedesignCore.js")],
      {
        env: { ...process.env, DB_NAME: TARGET_DB },
        stdio: "inherit",
      },
    );
    if (seed.status !== 0) {
      throw new Error("seedRedesignCore failed");
    }

    // Backfill enrolment from SOURCE into TARGET dual-write tables
    console.log("\nBackfilling enrolment from source DB…");
    const backfill = spawnSync(
      process.execPath,
      [path.resolve(__dirname, "backfillEnrolmentFromSource.js"), `--source=${SOURCE_DB}`, `--target=${TARGET_DB}`],
      { env: { ...process.env, DB_NAME: TARGET_DB }, stdio: "inherit" },
    );
    if (backfill.status !== 0) {
      console.warn("⚠️  Enrolment backfill skipped or failed (see above)");
    }

    const { count, names } = await countTables(TARGET_DB);
    console.log(`\n✅  Lean database \`${TARGET_DB}\` ready with ${count} tables:`);
    names.forEach((n) => console.log(`   - ${n}`));
    console.log(`\nNext:`);
    console.log(`  1. Keep running the app on DB_NAME=${SOURCE_DB} (full system)`);
    console.log(`  2. Or set DB_NAME=${TARGET_DB} only for platform/redesign work`);
    console.log(`  3. Do NOT drop tables from ${SOURCE_DB} until all modules migrate`);
    process.exit(0);
  } catch (err) {
    console.error("❌  createLeanDatabase failed:", err);
    process.exit(1);
  }
})();
