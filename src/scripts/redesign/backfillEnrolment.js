/**
 * Backfill existing enrolment_reports into form_submissions + facts.
 * Usage: npm run db:redesign:backfill-enrolment
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
require("../../models/redesign");
const { EnrolmentReport, EnrolmentReportLine } = require("../../models");
const { dualWriteEnrolment } = require("../../services/redesign/enrolmentDualWrite");

(async () => {
  try {
    await sequelize.authenticate();
    const reports = await EnrolmentReport.findAll({
      include: [{ model: EnrolmentReportLine, as: "lines" }],
      order: [["id", "ASC"]],
    });
    console.log(`Found ${reports.length} enrolment reports`);

    let ok = 0;
    let fail = 0;
    for (const report of reports) {
      const result = await dualWriteEnrolment(report, {
        action: "backfill",
        fromStatus: null,
      });
      if (result) ok += 1;
      else fail += 1;
    }

    console.log(`✅  Backfill done — ok=${ok} fail=${fail}`);
    process.exit(fail ? 1 : 0);
  } catch (err) {
    console.error("❌  Backfill failed:", err);
    process.exit(1);
  }
})();
