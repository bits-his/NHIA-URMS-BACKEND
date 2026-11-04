/**
 * Seed realistic Enrolment Drive workflow data for the dashboard.
 * Creates batches, activities, programme/audience selections, linked
 * enrolment counts, and a few follow-up actions across multiple states.
 *
 *   node src/scripts/seedEnrolmentDriveDemo.js
 *   npm run db:seed-enrolment-drive-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const { EnrolmentDriveReport, EnrolmentReport, StateOffice, User } = require("../models");
const {
  EnrolmentDriveBatch: Batch,
  EnrolmentDriveProgramme: Programme,
  EnrolmentDriveAudience: Audience,
  EnrolmentDriveAction: Action,
  EnrolmentDriveReview: Review,
} = require("../models/enrolment/EnrolmentDriveWorkflow");
const { ENROLMENT_DRIVE_TYPES } = require("../utils/enrolmentDriveTypes");
const rules = require("../utils/enrolmentDriveWorkflow");

const YEAR = 2026;
const PREFIX = "ED-DEMO";
const BATCH_PREFIX = "EDB-DEMO";
const ENROL_PREFIX = "ENR-DEMO";
const ACTION_PREFIX = "EDA-DEMO";
const REVIEW_PREFIX = "EDR-DEMO";

const LOCATION_PICKS = [
  { category: "Community and Traditional", name: "Market" },
  { category: "Community and Traditional", name: "Community Centre" },
  { category: "Institutional", name: "Workplace" },
  { category: "Institutional", name: "Tertiary Institution" },
  { category: "Health Sector", name: "Health Facility" },
  { category: "Government", name: "Local Government Secretariat" },
  { category: "Media", name: "Radio Station" },
  { category: "Stakeholder Organisation", name: "Trade/Business Association Office" },
];

const AUDIENCE_PICKS = [
  ["General Public", "Informal Sector"],
  ["Market Association", "Artisan Group"],
  ["Students", "Youth"],
  ["Employers", "Private Company"],
  ["Community Leaders", "Traditional Rulers"],
  ["Women", "Existing Beneficiaries"],
  ["Religious Organisation", "General Public"],
  ["HCPs", "HMOs"],
];

const PROGRAMME_PICKS = [
  ["FSSHIP", "OPS"],
  ["BHCPF"],
  ["GIFSHIP-G", "GIFSHIP-C"],
  ["FSSHIP", "BHCPF"],
  ["TISHIP", "CBSHIP"],
  ["CEmONC", "FFP"],
  ["FSSHIP"],
  ["GIFSHIP-R", "OPS"],
];

const ACTIVITY_STATUSES = ["Completed", "Completed", "Completed", "In Progress", "Deferred", "Completed", "Completed", "Not Conducted"];
const BATCH_STATUSES = ["submitted", "submitted", "endorsed", "awaiting_review", "draft", "submitted", "returned", "submitted"];

function pad(n, w = 3) {
  return String(n).padStart(w, "0");
}

function dayInMonth(month, offset) {
  return String(Math.min(27, 3 + (offset % 24))).padStart(2, "0");
}

function monthDeadline(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-28`;
}

async function clearDemo() {
  const demoDriveIds = (
    await EnrolmentDriveReport.findAll({
      where: { reference_id: { [Op.like]: `${PREFIX}-%` } },
      attributes: ["reference_id"],
      raw: true,
    })
  ).map((row) => row.reference_id);

  const demoBatchIds = (
    await Batch.findAll({
      where: { reference_id: { [Op.like]: `${BATCH_PREFIX}-%` } },
      attributes: ["reference_id"],
      raw: true,
    })
  ).map((row) => row.reference_id);

  const demoActionIds = (
    await Action.findAll({
      where: { reference_id: { [Op.like]: `${ACTION_PREFIX}-%` } },
      attributes: ["reference_id"],
      raw: true,
    })
  ).map((row) => row.reference_id);

  if (demoDriveIds.length) {
    await Programme.destroy({ where: { drive_reference_id: { [Op.in]: demoDriveIds } } });
    await Audience.destroy({ where: { drive_reference_id: { [Op.in]: demoDriveIds } } });
    await EnrolmentReport.destroy({ where: { drive_reference_id: { [Op.in]: demoDriveIds } } });
  }
  await EnrolmentReport.destroy({ where: { reference_id: { [Op.like]: `${ENROL_PREFIX}-%` } } });
  if (demoActionIds.length) {
    await Action.destroy({ where: { reference_id: { [Op.in]: demoActionIds } } });
  }
  if (demoBatchIds.length) {
    await Review.destroy({ where: { batch_reference_id: { [Op.in]: demoBatchIds } } });
  }
  await EnrolmentDriveReport.destroy({ where: { reference_id: { [Op.like]: `${PREFIX}-%` } } });
  await Batch.destroy({ where: { reference_id: { [Op.like]: `${BATCH_PREFIX}-%` } } });
}

async function main() {
  await sequelize.authenticate();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!EnrolmentDriveReport || !Batch) {
    throw new Error("Enrolment drive models not loaded — check APPROVED_FORMS['enrolment-drives']");
  }

  const user = await User.findOne({ where: { is_active: true }, order: [["id", "ASC"]] });
  if (!user) throw new Error("No active user — seed users first");

  const states = await StateOffice.findAll({
    order: [["zonal_code", "ASC"], ["code", "ASC"]],
    limit: 18,
  });
  if (states.length < 6) {
    throw new Error("Need at least 6 state_offices — seed zones/states first");
  }

  console.log("Clearing previous enrolment-drive demo rows…");
  await clearDemo();

  const months = [8, 9, 10, 11]; // Aug–Nov 2026

  // One batch per state+period — clear any non-demo rows that would collide.
  const collide = await Batch.findAll({
    where: {
      reporting_year: YEAR,
      reporting_month: { [Op.in]: months },
      state_code: { [Op.in]: states.map((s) => s.code) },
    },
    attributes: ["reference_id"],
    raw: true,
  });
  if (collide.length) {
    const collideIds = collide.map((row) => row.reference_id);
    const collideDrives = (
      await EnrolmentDriveReport.findAll({
        where: { batch_reference_id: { [Op.in]: collideIds } },
        attributes: ["reference_id"],
        raw: true,
      })
    ).map((row) => row.reference_id);
    if (collideDrives.length) {
      await Programme.destroy({ where: { drive_reference_id: { [Op.in]: collideDrives } } });
      await Audience.destroy({ where: { drive_reference_id: { [Op.in]: collideDrives } } });
      await EnrolmentReport.destroy({ where: { drive_reference_id: { [Op.in]: collideDrives } } });
      await EnrolmentDriveReport.destroy({ where: { reference_id: { [Op.in]: collideDrives } } });
    }
    await Review.destroy({ where: { batch_reference_id: { [Op.in]: collideIds } } });
    await Action.destroy({ where: { batch_reference_id: { [Op.in]: collideIds } } });
    await Batch.destroy({ where: { reference_id: { [Op.in]: collideIds } } });
    console.log(`Cleared ${collideIds.length} existing batch(es) for ${YEAR} months ${months.join(",")}`);
  }

  let batchN = 0;
  let driveN = 0;
  let enrolN = 0;
  let actionN = 0;
  let reviewN = 0;

  const batchesCreated = [];
  const drivesCreated = [];

  for (let si = 0; si < states.length; si += 1) {
    const state = states[si];
    for (let mi = 0; mi < months.length; mi += 1) {
      // Skip some state/month combos so a few offices show as "no report"
      if (si % 7 === 6 && mi === months.length - 1) continue;

      const month = months[mi];
      batchN += 1;
      const batchId = `${BATCH_PREFIX}-${pad(batchN)}`;
      const batchStatus = BATCH_STATUSES[(si + mi) % BATCH_STATUSES.length];
      const planned = 3 + ((si + mi) % 4);
      const submitted = ["awaiting_review", "returned", "endorsed", "submitted"].includes(batchStatus);
      const finalised = batchStatus === "submitted";
      const deadline = monthDeadline(YEAR, month);
      const late = si % 5 === 0 && finalised;

      await Batch.create({
        reference_id: batchId,
        state_code: state.code,
        zonal_code: state.zonal_code,
        reporting_year: YEAR,
        reporting_month: month,
        planned_activities: planned,
        reporting_officer: user.name || user.staff_id || "Demo Officer",
        created_by_user_id: user.id,
        submitted_by_user_id: submitted ? user.id : null,
        status: batchStatus,
        submitted_at: submitted ? new Date(`${YEAR}-${String(month).padStart(2, "0")}-20T09:00:00Z`) : null,
        finalised_at: finalised
          ? new Date(`${YEAR}-${String(month).padStart(2, "0")}-${late ? "30" : "22"}T11:00:00Z`)
          : null,
        revision: 1,
        reporting_deadline: deadline,
      });
      batchesCreated.push(batchId);

      if (submitted) {
        reviewN += 1;
        await Review.create({
          reference_id: `${REVIEW_PREFIX}-${pad(reviewN)}`,
          batch_reference_id: batchId,
          action: finalised ? "final_submit" : "send_for_review",
          from_status: "draft",
          to_status: batchStatus,
          revision: 1,
          note: finalised ? "Demo final submission" : "Demo review hand-off",
          actor_user_id: user.id,
          actor_name: user.name || "Demo Actor",
        });
      }

      const activityCount = Math.max(1, planned - (si % 3 === 0 ? 1 : 0));
      for (let ai = 0; ai < activityCount; ai += 1) {
        driveN += 1;
        const type = ENROLMENT_DRIVE_TYPES[(si + mi + ai) % ENROLMENT_DRIVE_TYPES.length];
        const category = type.categories[ai % type.categories.length];
        const location = LOCATION_PICKS[(si + ai) % LOCATION_PICKS.length];
        const programmes = PROGRAMME_PICKS[(si + mi + ai) % PROGRAMME_PICKS.length];
        const audiences = AUDIENCE_PICKS[(si + ai) % AUDIENCE_PICKS.length];
        const status = ACTIVITY_STATUSES[(si + mi + ai) % ACTIVITY_STATUSES.length];
        const completed = status === "Completed";
        const inProgress = status === "In Progress";
        const reached = completed || inProgress ? 80 + ((si * 17 + mi * 11 + ai * 23) % 420) : 0;
        const leads = completed || inProgress ? Math.round(reached * (0.22 + ((si + ai) % 5) * 0.03)) : 0;
        const enrolled = completed ? Math.round(leads * (0.45 + ((mi + ai) % 4) * 0.08)) : inProgress ? Math.round(leads * 0.2) : 0;
        const driveId = `${PREFIX}-${pad(driveN)}`;
        const activityDay = dayInMonth(month, si + ai);

        await EnrolmentDriveReport.create({
          reference_id: driveId,
          drive_type: type.key,
          drive_code: category.code,
          zonal_code: state.zonal_code,
          state_code: state.code,
          reporting_year: YEAR,
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          submission_date: submitted ? `${YEAR}-${String(month).padStart(2, "0")}-20` : null,
          submitted_by: submitted ? (user.name || "Demo Officer") : null,
          status: finalised ? "submitted" : submitted ? "submitted" : "draft",
          batch_reference_id: batchId,
          activity_date: `${YEAR}-${String(month).padStart(2, "0")}-${activityDay}`,
          activity_category: category.label,
          specific_activity: `${category.label} — ${state.code} demo outreach`,
          funding_option: ai % 2 === 0 ? rules.FUNDING[0] : rules.FUNDING[1],
          activity_budget: ai % 2 === 0 ? null : 75000 + ai * 15000,
          approved_amount: ai % 2 === 0 ? null : 70000 + ai * 12000,
          target_audience: audiences,
          location_category: location.category,
          location_name: location.name,
          exact_location: `${location.name}, ${state.description || state.code}`,
          programs_supported: programmes,
          activity_details: `Seeded enrolment drive activity for dashboard analytics (${type.title}).`,
          planned_target_audience: reached ? reached + 40 : 100 + ai * 20,
          target_audience_reached: reached,
          leads_generated: leads,
          new_enrolments: enrolled,
          activity_status: status,
          status_reason: ["Deferred", "Not Conducted", "Cancelled"].includes(status)
            ? "Operational constraint (demo)"
            : null,
          evidence_type: completed ? "Photographs" : "Field Report",
          remarks: completed ? "Demo completed activity" : null,
          planned_activities: planned,
          created_by_user_id: user.id,
          revision: 1,
          supporting_documents: [],
        });
        drivesCreated.push(driveId);

        await Programme.bulkCreate(
          programmes.filter((p) => rules.PROGRAMMES.includes(p)).map((programme) => ({
            drive_reference_id: driveId,
            programme,
          })),
        );
        await Audience.bulkCreate(
          audiences.filter((a) => rules.AUDIENCES.includes(a)).map((audience) => ({
            drive_reference_id: driveId,
            audience,
          })),
        );

        if (enrolled > 0) {
          enrolN += 1;
          await EnrolmentReport.create({
            reference_id: `${ENROL_PREFIX}-${pad(enrolN)}`,
            zonal_code: state.zonal_code,
            state_code: state.code,
            reporting_year: YEAR,
            reporting_month: month,
            quarter: Math.ceil(month / 3),
            submission_date: `${YEAR}-${String(month).padStart(2, "0")}-21`,
            submitted_by: user.name || "Demo Officer",
            status: "submitted",
            drive_reference_id: driveId,
            drive_enrolment_mode: "linked",
            category: "enrolment",
            activity_code: category.code,
            activity_date: `${YEAR}-${String(month).padStart(2, "0")}-${activityDay}`,
            enrolment_channel: "Field drive",
            enrolment_type: "New",
            program_code: programmes[0],
            program_name: programmes[0],
            enrolment_category: "Formal",
            beneficiary_category: "Principal",
            beneficiary_status: "Active",
            funding_option: ai % 2 === 0 ? rules.FUNDING[0] : rules.FUNDING[1],
            enrolment_count: enrolled,
            enrollees_validated: Math.round(enrolled * 0.9),
            activity_status: "Completed",
            remarks: "Linked enrolment total from demo drive",
            created_by_user_id: user.id,
          });
        }
      }
    }
  }

  // Follow-up actions for a few offices that look weak
  const actionStates = states.slice(0, 5);
  for (let i = 0; i < actionStates.length; i += 1) {
    const state = actionStates[i];
    actionN += 1;
    await Action.create({
      reference_id: `${ACTION_PREFIX}-${pad(actionN)}`,
      state_code: state.code,
      zonal_code: state.zonal_code,
      reporting_year: YEAR,
      reporting_month: 11,
      issue: i % 2 === 0
        ? "Low lead-to-enrolment conversion on recent market outreach"
        : "Deferred community drives pending venue confirmation",
      source_dashboard: "Enrolment Drives",
      agreed_action: i % 2 === 0
        ? "Deploy on-site registration kit and weekly conversion review"
        : "Reschedule deferred activities before month-end deadline",
      accountable_owner: user.name || "State Coordinator",
      owner_user_id: user.id,
      deadline: `${YEAR}-11-25`,
      status: i === 0 ? "In progress" : "Open",
      outcome: null,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    });
  }

  console.log("Enrolment drive demo seed complete:");
  console.log(`  Batches:     ${batchesCreated.length}`);
  console.log(`  Activities:  ${drivesCreated.length}`);
  console.log(`  Enrolments:  ${enrolN}`);
  console.log(`  Actions:     ${actionN}`);
  console.log(`  Reviews:     ${reviewN}`);
  console.log(`  States used: ${states.length}`);
  console.log(`  Period:      ${YEAR} months ${months.join(", ")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
