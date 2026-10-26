/**
 * Seed varied Provider Management (accreditation) activity lines so the
 * four dashboard levels have chartable data for the current year.
 *
 *   node src/scripts/seedProviderManagementDashboard.js
 */
require("dotenv").config();
const {
  AccreditationReport,
  AccreditationReportLine,
  StateOffice,
  ZonalOffice,
} = require("../models");

const YEAR = new Date().getFullYear();
const ACTIVITIES = [
  { key: "accreditation", category: "Accreditation", code: "PM-0001" },
  { key: "reaccreditation", category: "Re-accreditation", code: "PM-0002" },
  { key: "qa-inspections", category: "Quality Assurance", code: "PM-0003" },
  { key: "medical-audits", category: "Medical Audit", code: "PM-0004" },
];
const PROGRAMMES = ["FSSHIP", "BHCPF", "Other"];
const STATUSES = ["Completed", "Completed", "Completed", "In Progress", "Not Conducted", "Deferred"];

function pick(arr, i) {
  return arr[i % arr.length];
}

async function main() {
  const states = await StateOffice.findAll({
    include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "description"] }],
    order: [["id", "ASC"]],
    limit: 12,
  });
  if (!states.length) throw new Error("No states found");

  let reportN = 0;
  let lineN = 0;

  for (let si = 0; si < states.length; si++) {
    const state = states[si];
    for (let month = 1; month <= 6; month++) {
      const activity = pick(ACTIVITIES, si + month);
      const programme = pick(PROGRAMMES, si * 3 + month);
      const status = pick(STATUSES, si + month);
      const planned = 15 + ((si * 7 + month * 3) % 40);
      const covered = status === "Completed"
        ? Math.round(planned * (0.55 + ((si + month) % 5) * 0.08))
        : status === "In Progress"
          ? Math.round(planned * 0.35)
          : Math.round(planned * 0.1);
      const totalState = 80 + (si % 6) * 25;
      const ref = `ACC-PM-DASH-${YEAR}-${String(state.id).padStart(2, "0")}-M${String(month).padStart(2, "0")}`;

      let report = await AccreditationReport.findOne({ where: { reference_id: ref } });
      if (!report) {
        report = await AccreditationReport.create({
          reference_id: ref,
          zone_id: state.zonal_id || state.zone?.id,
          state_id: state.id,
          reporting_year: YEAR,
          reporting_month: month,
          submission_date: `${YEAR}-${String(month).padStart(2, "0")}-20`,
          submitted_by: "PM Dashboard Seed",
          status: "submitted",
          planned_activities: 1,
          activity_module: activity.key,
        });
        reportN += 1;
      } else {
        await report.update({
          activity_module: activity.key,
          status: "submitted",
          planned_activities: 1,
        });
      }

      await AccreditationReportLine.destroy({ where: { report_id: report.id } });
      const metrics = {};
      if (activity.key === "accreditation") {
        metrics["Number of Facilities Awaiting Accreditation"] = 20 + (si % 8) * 5;
        if (programme === "BHCPF") metrics["Number of PHCs Awaiting Accreditation"] = 12 + (si % 5) * 3;
      }
      if (activity.key === "reaccreditation") {
        metrics["Number of Facilities Awaiting Re-accreditation"] = 10 + (si % 6) * 4;
        if (programme === "BHCPF") metrics["Number of PHCs Awaiting Re-accreditation"] = 8 + (si % 4) * 2;
      }

      await AccreditationReportLine.create({
        report_id: report.id,
        indicator: "accreditation_applications",
        primary_count: covered,
        secondary_count: planned,
        activity_template: {
          provider_management_id: `PM-${YEAR}-${String(si * 10 + month).padStart(4, "0")}`,
          form_type: activity.key,
          engagement_code: activity.code,
          engagement_category: activity.category,
          related_programme: programme,
          bhcpf_activity_type: programme === "BHCPF"
            ? (activity.key === "reaccreditation" ? "Reaccreditation" : "Accreditation")
            : null,
          total_facilities_in_state: totalState,
          facilities_planned: planned,
          activity_date: `${YEAR}-${String(month).padStart(2, "0")}-15`,
          facilities_covered: covered,
          funding_option: "Routine",
          activity_status: status,
          remarks: "Dashboard seed",
          metrics,
          facilities_accredited: activity.key === "accreditation" ? covered : 0,
          facilities_reaccredited: activity.key === "reaccreditation" ? covered : 0,
          phcs_accredited: programme === "BHCPF" && activity.key === "accreditation" ? covered : 0,
          phcs_reaccredited: programme === "BHCPF" && activity.key === "reaccreditation" ? covered : 0,
          programs_supported: [programme],
        },
      });
      lineN += 1;
    }
  }

  console.log(`Seeded/updated ${reportN} new reports, ${lineN} activity lines for ${YEAR}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
