require("dotenv").config();
const { randomBytes } = require("crypto");
const sequelize = require("../../config/database");
const { Challenge, SupportRequest, RecordHistory } = require("../../models/ChallengesSupport");
const { StateOffice } = require("../../models");
const T = require("../../utils/challengesSupportTypes");

const reference = (prefix) => `${prefix}-${new Date().getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;

/** Map a legacy line's category text (label or key) to the canonical key/label */
function legacyCategory(raw) {
  const v = String(raw || "").trim();
  const cat = T.CHALLENGE_CATEGORIES.find((c) => c.label === v || c.key === v);
  return cat || T.CHALLENGE_CATEGORIES[0];
}

async function upgrade() {
  await sequelize.authenticate();
  await Challenge.sync();
  await SupportRequest.sync();
  await RecordHistory.sync();
  console.log("  synced challenges, support_requests, challenge_support_history");

  const [hasLegacy] = await sequelize.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('challenges_report_lines','challenges_reports') HAVING n = 2");
  const [lines] = hasLegacy.length
    ? await sequelize.query(`
    SELECT l.*, r.reference_id AS report_ref, r.zone_id, r.state_id, r.submission_date, r.submitted_by, r.created_at
    FROM challenges_report_lines l JOIN challenges_reports r ON r.id = l.report_id`)
    : [[]];
  if (!hasLegacy.length) console.log("  no legacy challenges tables — skipping migration");
  let migrated = 0;
  for (const line of lines) {
    const exists = await Challenge.findOne({ where: { legacy_line_id: line.id } });
    if (exists) continue;
    const [state] = await sequelize.query(`SELECT code, zonal_code FROM state_offices WHERE id = ?`, { replacements: [line.state_id] });
    const stateRow = state[0];
    if (!stateRow) { console.warn(`  skip line ${line.id}: state ${line.state_id} not found`); continue; }
    const cat = legacyCategory(line.challenge_category);
    const status = T.CHALLENGE_STATUSES.includes(line.status) ? line.status : "In-progress";
    const challenge = await Challenge.create({
      challenge_id: reference("CH"),
      state_code: stateRow.code, zonal_code: stateRow.zonal_code,
      date_reported: (line.submission_date || line.created_at || new Date()).toISOString?.().slice(0, 10) || String(line.submission_date || line.created_at).slice(0, 10),
      related_activity: T.CHALLENGE_RELATED_ACTIVITIES.includes(line.related_activity) ? line.related_activity : null,
      programme: T.CHALLENGE_PROGRAMS.includes(line.related_program) ? line.related_program : null,
      category_key: cat.key, category_label: cat.label,
      specific_challenge: line.specific_challenge || null,
      severity: T.CHALLENGE_SEVERITIES.includes(line.severity) ? line.severity : null,
      impact: line.impact || null,
      status,
      escalation_department: T.CHALLENGE_DEPARTMENTS.includes(line.responsible_department) ? line.responsible_department : (line.responsible_department || null),
      description: line.challenge_details || null,
      key_recommendation: line.key_recommendation || null,
      support_context: line.support_context || null,
      remarks: line.remarks || null,
      legacy_line_id: line.id,
      created_by_user_id: null,
      created_by_name: line.submitted_by || "Migration",
    });
    await RecordHistory.create({
      history_id: reference("HST"), challenge_id: challenge.challenge_id,
      action: "create", to_status: status,
      note: `Migrated from ${line.report_ref || "legacy challenges report"}`,
      actor_user_id: null, actor_name: line.submitted_by || "Migration",
    });
    if (line.support_required) {
      const catKey = Object.keys(T.SUPPORT_CATEGORY_SPECIFICS).find((k) =>
        T.SUPPORT_CATEGORY_SPECIFICS[k].includes(line.support_required));
      await SupportRequest.create({
        support_id: reference("SUP"),
        challenge_id: challenge.challenge_id,
        state_code: stateRow.code, zonal_code: stateRow.zonal_code,
        date_submitted: challenge.date_reported,
        action_required_from: "SDO",
        support_category: catKey || "Others",
        specific_support: catKey ? line.support_required : null,
        other_support: catKey ? null : line.support_required,
        priority: ["Critical", "High", "Medium", "Low"].includes(line.severity) ? line.severity : "Medium",
        description: line.support_context || `Migrated support need: ${line.support_required}`,
        operational_impact: line.impact || null,
        status: "Submitted",
        submitted_by_user_id: null,
        submitted_by_name: line.submitted_by || "Migration",
      });
    }
    migrated++;
  }
  console.log(`  migrated ${migrated} legacy challenge lines (${lines.length} found)`);
  process.exit(0);
}

upgrade().catch((e) => { console.error(e); process.exit(1); });
