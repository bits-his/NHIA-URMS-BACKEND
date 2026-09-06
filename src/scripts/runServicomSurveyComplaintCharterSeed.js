/**
 * Run SERVICOM seed SQL: 30 satisfaction surveys, 30 charter/comment cards, 30 complaints.
 *
 * Prerequisites: zones/states seeded (state_offices + zonal_offices).
 * Idempotent — deletes prior SAT-SEED-*, CCC-SEED-*, CMP-SEED-* rows first.
 *
 * Run: npm run db:seed-servicom-batch
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && (inSingle || inDouble)) {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === ";" && !inSingle && !inDouble) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main() {
  const sqlPath = path.join(__dirname, "seedServicomSurveyComplaintCharter.sql");
  let sql = fs.readFileSync(sqlPath, "utf8");
  sql = sql.replace(/^USE\s+\w+\s*;\s*/im, "");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "nhia_db",
    multipleStatements: true,
  });

  console.log("Running SERVICOM survey / charter / complaint seed…");
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    // Skip pure comment blocks
    const body = stmt
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (!body) continue;
    await conn.query(stmt);
  }

  const [sat] = await conn.query(
    "SELECT COUNT(*) AS c FROM servicom_satisfaction_surveys WHERE reference_id LIKE 'SAT-SEED-%'"
  );
  const [ccc] = await conn.query(
    "SELECT COUNT(*) AS c FROM servicom_comment_cards WHERE reference_id LIKE 'CCC-SEED-%'"
  );
  const [cmp] = await conn.query(
    "SELECT COUNT(*) AS c FROM servicom_complaints WHERE complaint_number LIKE 'CMP-SEED-%'"
  );

  console.log(`✓ Satisfaction surveys : ${sat[0].c}`);
  console.log(`✓ Charter / comment    : ${ccc[0].c}`);
  console.log(`✓ Complaints           : ${cmp[0].c}`);
  await conn.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
