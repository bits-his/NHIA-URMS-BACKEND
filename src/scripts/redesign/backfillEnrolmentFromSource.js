/**
 * Read enrolment_reports from a SOURCE database and dual-write into the
 * current (TARGET) DB's form engine. Used when the lean DB has no legacy tables.
 *
 * Usage:
 *   DB_NAME=nhia_urms_v2 node src/scripts/redesign/backfillEnrolmentFromSource.js --source=nhia_db
 */
require("dotenv").config();
const mysql = require("mysql2/promise");
const { dualWriteEnrolment } = require("../../services/redesign/enrolmentDualWrite");
require("../../models/redesign");

const args = process.argv.slice(2);
const sourceArg = args.find((a) => a.startsWith("--source="));
const SOURCE_DB = sourceArg ? sourceArg.split("=")[1] : "nhia_db";

const HOST = process.env.DB_HOST || "localhost";
const PORT = Number(process.env.DB_PORT) || 3306;
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASSWORD || "";

(async () => {
  try {
    const source = await mysql.createConnection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      database: SOURCE_DB,
    });

    const [[{ c }]] = await source.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'enrolment_reports'`,
      [SOURCE_DB],
    );
    if (!c) {
      console.log(`ℹ️   No enrolment_reports in ${SOURCE_DB} — skip backfill`);
      await source.end();
      process.exit(0);
    }

    const [reports] = await source.query(
      `SELECT * FROM enrolment_reports ORDER BY id ASC`,
    );
    console.log(`Found ${reports.length} enrolment reports in ${SOURCE_DB}`);

    let ok = 0;
    let fail = 0;
    for (const report of reports) {
      const [lines] = await source.query(
        `SELECT * FROM enrolment_report_lines WHERE report_id = ? ORDER BY id ASC`,
        [report.id],
      );
      const payload = { ...report, lines };
      const result = await dualWriteEnrolment(payload, { action: "backfill" });
      if (result) ok += 1;
      else fail += 1;
    }

    await source.end();
    console.log(`✅  Cross-DB backfill — ok=${ok} fail=${fail}`);
    process.exit(fail ? 1 : 0);
  } catch (err) {
    console.error("❌  backfillEnrolmentFromSource failed:", err);
    process.exit(1);
  }
})();
