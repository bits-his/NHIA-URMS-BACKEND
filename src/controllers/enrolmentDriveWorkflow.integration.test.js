const test = require("node:test");
const assert = require("node:assert/strict");
const sequelize = require("../config/database");
const models = require("../models");
const workflow = require("../models/enrolment/EnrolmentDriveWorkflow");
const ctrl = require("./enrolmentDriveWorkflow.controller");
const enrolment = require("./enrolmentPack.controller");
const { reference } = require("../utils/enrolmentDriveWorkflow");

async function call(handler, user, params = {}, body = {}) {
  let result;
  let failure;
  await handler({ user, params, body, query: {} }, { json: (value) => { result = value; }, status: () => ({ json: (value) => { result = value; } }) }, (error) => { failure = error; });
  if (failure) throw failure;
  return result;
}

test("database workflow preserves links, locks review, calculates counts, and rolls back all test data", { skip: process.env.RUN_DRIVE_DB_TESTS !== "1" }, async (context) => {
  const state = await models.StateOffice.findOne();
  const users = await models.User.findAll({ where: { is_active: true }, attributes: ["id", "name", "staff_id"], limit: 2 });
  if (!state || users.length < 2) { context.skip("Requires reference states and two existing active users"); await sequelize.close(); return; }
  const officer = { id: users[0].id, name: users[0].name, role: "admin" };
  const reviewer = { id: users[1].id, name: users[1].name, role: "admin" };
  const transaction = await sequelize.transaction();
  const originalTransaction = sequelize.transaction;
  const registered = Object.values(sequelize.models);
  for (const Model of registered) {
    Model.addHook("beforeFind", "drive_test_transaction", (options) => { options.transaction = transaction; });
    Model.addHook("beforeCount", "drive_test_transaction", (options) => { options.transaction = transaction; });
  }
  sequelize.transaction = async (callback) => callback(transaction);
  try {
    const batch = await workflow.EnrolmentDriveBatch.create({ reference_id: reference("TDB"), state_code: state.code, zonal_code: state.zonal_code, reporting_year: 2099, reporting_month: 11, planned_activities: 10, reporting_officer: officer.name || "Test officer", created_by_user_id: officer.id }, { transaction });
    const values = { drive_type: "advocacy", activity_category: "Advocacy", activity_date: "2099-11-05", specific_activity: "Integration test", location_category: "Virtual", location_name: "Online", exact_location: "Test virtual meeting", programs_supported: ["FSSHIP", "OPS"], target_audience: ["General Public"], planned_target_audience: 50, target_audience_reached: 40, leads_generated: 10, activity_status: "In Progress", funding_option: "Zero-Cost (Statutory Mandate)", evidence_type: "Field Report", activity_details: "Transaction-scoped integration test", complete: true };
    const saved = await call(ctrl.createActivity, officer, { id: batch.reference_id }, values);
    const driveId = saved.data.reference_id;
    assert(driveId);
    assert.equal(await workflow.EnrolmentDriveProgramme.count({ where: { drive_reference_id: driveId } }), 2);
    const payload = { reporting_year: 2099, reporting_month: 12, state_code: state.code, zonal_code: state.zonal_code, drive_reference_id: driveId, status: "draft", lines: [{ category: "enrolment", program_name: "FSSHIP", enrolment_channel: "NHIA", enrolment_count: 3 }] };
    const registeredEnrolment = await call(enrolment.createReport, officer, {}, payload);
    assert.equal(registeredEnrolment.data.drive_reference_id, driveId);
    assert.equal(registeredEnrolment.data.enrolment_category, "Field Registration");
    let report = (await call(ctrl.getBatch, officer, { id: batch.reference_id })).data;
    assert.equal(report.summary.planned, 10);
    assert.equal(report.summary.enrolled, 3);
    assert.equal(report.summary.conducted, 0);
    assert.equal(report.activities.length, 1);
    await call(ctrl.updateActivity, officer, { driveId }, { ...values, revision: report.activities[0].revision, specific_activity: "Edited activity" });
    report = (await call(ctrl.getBatch, officer, { id: batch.reference_id })).data;
    assert.equal(report.activities.length, 1);
    assert.equal(report.summary.enrolled, 3);
    await assert.rejects(() => call(ctrl.getBatch, { role: "state-officer", state_code: "NOT-THIS-STATE" }, { id: batch.reference_id }), /Access denied/);
    report = (await call(ctrl.changeStatus, officer, { id: batch.reference_id }, { action: "send_for_review", revision: report.revision })).data;
    assert.equal(report.status, "awaiting_review");
    await assert.rejects(() => call(ctrl.updateActivity, officer, { driveId }, { ...values, revision: report.activities[0].revision }), /locked/);
    await assert.rejects(() => call(ctrl.changeStatus, officer, { id: batch.reference_id }, { action: "endorse", note: "Self endorsement", revision: report.revision }), /not permitted/);
    report = (await call(ctrl.changeStatus, reviewer, { id: batch.reference_id }, { action: "endorse", note: "Reviewed independently", revision: report.revision })).data;
    assert.equal(report.status, "endorsed");
    report = (await call(ctrl.changeStatus, officer, { id: batch.reference_id }, { action: "final_submit", revision: report.revision })).data;
    assert.equal(report.status, "submitted");
    assert.equal(report.reviews.length, 3);
    report = (await call(ctrl.setDeadline, reviewer, { id: batch.reference_id }, { reporting_deadline: "2099-12-15", revision: report.revision })).data;
    assert.equal(report.reporting_deadline, "2099-12-15");
    const oldPath = "/uploads/beneficiary/drive-test.pdf";
    await models.EnrolmentDriveReport.update({ supporting_documents: [{ path: oldPath, name: "Evidence.pdf" }] }, { where: { reference_id: driveId }, transaction });
    const guard = require("../middleware/enrolmentDriveEvidenceGuard");
    for (const path of ["/beneficiary/drive-test.pdf", "/beneficiary/../beneficiary/drive-test.pdf", "/BENEFICIARY/DRIVE-TEST.PDF"]) {
      let status;
      let passed = false;
      let failure;
      await guard({ path }, { status: (code) => { status = code; return { json: () => {} }; } }, (error) => { passed = true; failure = error; });
      if (failure) throw failure;
      assert.equal(status, 404);
      assert.equal(passed, false);
    }
    const actionBody = { state_code: state.code, reporting_year: 2099, reporting_month: 11, issue: "Activities not conducted", source_dashboard: "Enrolment Drives", agreed_action: "Complete follow-up", accountable_owner: "Test officer", deadline: "2099-12-20", status: "Open" };
    const action = (await call(ctrl.saveAction, reviewer, {}, actionBody)).data;
    await assert.rejects(() => call(ctrl.saveAction, reviewer, { actionId: action.reference_id }, { ...actionBody, status: "Closed", outcome: "Resolved" }), /closure evidence/);
    await workflow.EnrolmentDriveEvidence.create({ reference_id: reference("TDE"), action_reference_id: action.reference_id, evidence_type: "Field Report", original_name: "Closure.pdf", storage_key: "transaction-only-test.pdf", mime_type: "application/pdf", file_size: 1, uploaded_by_user_id: reviewer.id }, { transaction });
    const closed = (await call(ctrl.saveAction, reviewer, { actionId: action.reference_id }, { ...actionBody, status: "Closed", outcome: "Resolved" })).data;
    assert.equal(closed.status, "Closed");
    assert(closed.closure_date);
    await assert.rejects(() => call(ctrl.saveAction, reviewer, { actionId: action.reference_id }, actionBody), /closed/);
  } finally {
    sequelize.transaction = originalTransaction;
    for (const Model of registered) {
      Model.removeHook("beforeFind", "drive_test_transaction");
      Model.removeHook("beforeCount", "drive_test_transaction");
    }
    await transaction.rollback();
    await sequelize.close();
  }
});
