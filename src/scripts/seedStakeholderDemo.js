/**
 * Seed demo Stakeholder rows + outcomes + shared form_documents.
 *   node src/scripts/seedStakeholderDemo.js
 *   npm run db:seed-stakeholder-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  StakeholderReport,
  StakeholderOutcome,
  FormDocument,
  StateOffice,
} = require("../models");
const { replaceDocuments } = require("../utils/formDocuments");

async function dropLegacy() {
  const qi = sequelize.getQueryInterface();
  for (const t of [
    "stakeholder_report_lines",
    "beneficiary_management_documents",
  ]) {
    try {
      await qi.dropTable(t);
      console.log(`Dropped ${t}`);
    } catch (_) { /* */ }
  }
}

async function main() {
  await sequelize.authenticate();
  await dropLegacy();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!StakeholderReport || !StakeholderOutcome || !FormDocument) {
    throw new Error("Stakeholder models not loaded — ensure APPROVED_FORMS['stakeholder-management'] is set");
  }

  const state = await StateOffice.findOne({ order: [["code", "ASC"]] });
  if (!state) throw new Error("No state_offices — seed zones/states first");

  await FormDocument.destroy({
    where: { form_key: "stakeholder", report_reference_id: { [Op.like]: "STK-DEMO-%" } },
  });
  await StakeholderOutcome.destroy({
    where: { report_reference_id: { [Op.like]: "STK-DEMO-%" } },
  });
  await StakeholderReport.destroy({
    where: { reference_id: { [Op.like]: "STK-DEMO-%" } },
  });

  const common = {
    zonal_code: state.zonal_code,
    state_code: state.code,
    activity_module: "engagement-coordination",
    reporting_year: 2026,
    reporting_month: 10,
    quarter: 4,
    planned_activities: 2,
    submission_date: "2026-10-20",
    submitted_by: "Demo Seed",
    status: "awaiting_review",
  };

  await StakeholderReport.create({
    reference_id: "STK-DEMO-00001",
    engagement_code: "ENG-003",
    activity_date: "2026-10-10",
    engagement_category: "Post-enrolment Sensitization",
    stakeholder_categories: "Enrolees|SSHIA",
    stakeholder_names: "Enrolees, SSHIA",
    specific_activity: "Community sensitization on enrolment benefits",
    engagement_purpose: "Increase awareness",
    funding_option: "Yes",
    activity_budget: 150000,
    approved_amount: 120000,
    planned_target_audience_text: "Community leaders and enrolees",
    target_audience_reached: "Community Leaders|Enrolees",
    location_category: "Community_and_Traditional",
    location_name: "Community Hall",
    programs_supported: "PR-01|PR-03",
    supporting_evidence_types: "Attendance list|Photos",
    follow_up_required: "Yes",
    follow_up_date: "2026-11-01",
    follow_up_priority: "medium",
    follow_up_action: "Follow-up visit",
    activity_status: "Conducted",
    remarks: "Demo stakeholder engagement",
    ...common,
  });

  await StakeholderOutcome.create({
    report_reference_id: "STK-DEMO-00001",
    sn: 1,
    outcome_category: "Increased awareness",
    specific_outcome: "120 participants reached",
  });
  await StakeholderOutcome.create({
    report_reference_id: "STK-DEMO-00001",
    sn: 2,
    outcome_category: "Leads generated",
    specific_outcome: "35 enrolment leads",
  });

  await replaceDocuments("stakeholder", "STK-DEMO-00001", [
    {
      doc_kind: "supporting",
      name: "attendance-list.pdf",
      path: "/uploads/beneficiary/demo-stakeholder-attendance.pdf",
    },
    {
      doc_kind: "evidence",
      name: "photos.zip",
      path: "/uploads/beneficiary/demo-stakeholder-photos.zip",
    },
  ]);

  await StakeholderReport.create({
    reference_id: "STK-DEMO-00002",
    engagement_code: "ENG-002",
    activity_date: "2026-10-15",
    engagement_category: "Stakeholder Forum/Meeting",
    stakeholder_categories: "MDAs|HMOs",
    stakeholder_names: "MDAs, HMOs",
    specific_activity: "Quarterly forum",
    funding_option: "No",
    location_category: "Government Agency",
    location_name: "NHIA Office",
    programs_supported: "PR-01",
    activity_status: "Conducted",
    ...common,
  });

  const count = await StakeholderReport.count({
    where: { reference_id: { [Op.like]: "STK-DEMO-%" } },
  });
  console.log(`Seeded ${count} stakeholder rows for state ${state.code}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
