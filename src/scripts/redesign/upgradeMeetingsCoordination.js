require("dotenv").config();
const { randomBytes } = require("crypto");
const sequelize = require("../../config/database");
const { MeetingReport, MeetingItem, EtmcReport, EtmcEntry } = require("../../models/MeetingsCoordination");

const reference = (prefix) => `${prefix}-${new Date().getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;

async function upgrade() {
  await sequelize.authenticate();
  await MeetingReport.sync();
  await MeetingItem.sync();
  await EtmcReport.sync();
  await EtmcEntry.sync();
  console.log("  synced meeting_reports, meeting_items, etmc_reports, etmc_entries");

  // Migrate legacy admin_hr_reports payloads where the table exists
  const [hasLegacy] = await sequelize.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'admin_hr_reports'");
  if (!hasLegacy[0]?.n) { console.log("  no legacy admin_hr_reports — skipping migration"); process.exit(0); }

  const [reports] = await sequelize.query(
    "SELECT r.*, s.code AS state_code, z.zonal_code FROM admin_hr_reports r JOIN state_offices s ON s.id = r.state_id JOIN zonal_offices z ON z.id = r.zone_id WHERE r.report_type IN ('office-meeting','etmc-cascading')");
  let migrated = 0;
  for (const r of reports) {
    const p = typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : (r.payload || {});
    if (r.report_type === "office-meeting") {
      if (await MeetingReport.findByPk(`LGC-SOM-${r.id}`)) continue;
      const strength = Number(p.staff_strength) || null;
      const attendees = Number(p.attendees) || null;
      const meeting = await MeetingReport.create({
        meeting_id: `LGC-SOM-${r.id}`,
        state_code: r.state_code, zonal_code: r.zonal_code,
        reporting_year: r.reporting_year, reporting_month: r.reporting_month,
        meeting_date: p.meeting_date || r.submission_date || r.created_at,
        meeting_type: p.meeting_type || "Monthly Meeting",
        other_meeting_type: p.other_meeting_type || null,
        purpose: p.purpose || null,
        presiding_officer: p.presiding_officer || null,
        venue: p.venue || null,
        staff_strength: strength, attendees,
        attendance_rate: strength && attendees != null ? Math.round((attendees / strength) * 10000) / 100 : null,
        eff_prev_reviewed: p.eff_prev_reviewed || null,
        eff_issues_discussed: p.eff_issues_discussed || null,
        eff_decisions_documented: p.eff_decisions_documented || null,
        eff_officers_assigned: p.eff_officers_assigned || null,
        eff_deadlines_assigned: p.eff_deadlines_assigned || null,
        eff_escalations_identified: p.eff_escalations_identified || null,
        eff_attendance_adequate: p.eff_attendance_adequate || null,
        prepared_by: r.submitted_by || p.prepared_by || null,
        designation: p.designation || null,
        submission_date: r.submission_date || null,
        endorsed_by: p.endorsed_by || null,
        status: r.status === "approved" ? "approved" : r.status === "submitted" ? "submitted" : "draft",
        created_by_user_id: null,
        created_by_name: r.submitted_by || "Migration",
      });
      const kinds = { agenda_items: "agenda", decisions: "decision", followups: "followup" };
      let n = 0;
      for (const [key, kind] of Object.entries(kinds)) {
        for (const item of Array.isArray(p[key]) ? p[key] : []) {
          n += 1;
          await MeetingItem.create({
            item_id: reference("MIT"), meeting_id: meeting.meeting_id, item_kind: kind,
            subject: item.subject || item.agenda || item.decision || item.action_point || null,
            detail: item.detail || item.issue || item.progress || null,
            outcome: item.outcome || null,
            requires_action: item.requires_action || null,
            action_ref: kind === "decision" ? `TAR-MMR-${r.reporting_year}-${String(r.reporting_month).padStart(2, "0")}-${String(n).padStart(3, "0")}` : null,
            responsible_officer: item.responsible_officer || null,
            due_date: item.due_date || item.deadline || null,
            expected_output: item.expected_output || null,
            status: item.status || "Pending",
            remarks: item.remarks || null,
          });
        }
      }
      migrated++;
    } else {
      if (await EtmcReport.findByPk(`LGC-ETC-${r.id}`)) continue;
      const strength = Number(p.staff_strength) || null;
      const present = Number(p.staff_present) || null;
      const report = await EtmcReport.create({
        etmc_id: `LGC-ETC-${r.id}`,
        state_code: r.state_code, zonal_code: r.zonal_code,
        reporting_year: r.reporting_year, reporting_month: r.reporting_month,
        etmc_meeting_date: p.etmc_meeting_date || r.submission_date || r.created_at,
        cascade_session_date: p.cascade_session_date || null,
        etmc_session: p.etmc_session || null,
        presiding_officer: p.presiding_officer || null,
        venue: p.venue || null,
        staff_strength: strength, staff_present: present,
        attendance_rate: strength && present != null ? Math.round((present / strength) * 10000) / 100 : null,
        ev_attendance_list: p.ev_attendance_list || null,
        ev_minutes: p.ev_minutes || null,
        ev_presentation: p.ev_presentation || null,
        ev_photographs: p.ev_photographs || null,
        ev_action_tracker: p.ev_action_tracker || null,
        ev_escalations_documented: p.ev_escalations_documented || null,
        prepared_by: r.submitted_by || p.prepared_by || null,
        designation: p.designation || null,
        submission_date: r.submission_date || null,
        endorsed_by: p.endorsed_by || null,
        status: r.status === "approved" ? "approved" : r.status === "submitted" ? "submitted" : "draft",
        created_by_user_id: null,
        created_by_name: r.submitted_by || "Migration",
      });
      const kinds = { highlights: "highlight", department_updates: "department_update", resolutions: "resolution", comments: "comment", feedback: "feedback" };
      for (const [key, kind] of Object.entries(kinds)) {
        for (const e of Array.isArray(p[key]) ? p[key] : []) {
          await EtmcEntry.create({
            entry_id: reference("ETE"), etmc_id: report.etmc_id, entry_kind: kind,
            subject: e.subject || e.department || null,
            detail: e.detail || e.update || e.resolution || e.comment || e.feedback || null,
            owner_deadline: e.owner_deadline || null,
          });
        }
      }
      migrated++;
    }
  }
  console.log(`  migrated ${migrated} legacy reports (${reports.length} found)`);
  process.exit(0);
}

upgrade().catch((e) => { console.error(e); process.exit(1); });
