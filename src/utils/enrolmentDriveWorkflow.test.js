const test = require("node:test");
const assert = require("node:assert/strict");
const { activityValues, nextStatus, totals, assertScope, scopeWhere, reference } = require("./enrolmentDriveWorkflow");

const activity = () => ({ activity_category: "Advocacy", activity_date: "2026-04-12", specific_activity: "Community mobilisation", location_category: "Media", location_name: "Radio Station", exact_location: "State radio station", activity_details: "Programme awareness and registration", programs_supported: ["FSSHIP", "OPS"], target_audience: ["General Public"], planned_target_audience: 100, target_audience_reached: 80, leads_generated: 20, activity_status: "Completed", funding_option: "Zero-Cost (Statutory Mandate)", evidence_type: "Photographs" });

test("location choices are validated against their category", () => {
  assert.equal(activityValues(activity(), { complete: true, year: 2026, month: 4 }).location_name, "Radio Station");
  assert.throws(() => activityValues({ ...activity(), location_category: "Virtual" }), /selected category/);
  assert.equal(activityValues({ ...activity(), location_category: "Virtual", location_name: "Online" }).location_name, "Online");
});
test("budgeted activities require both amounts; zero cost clears stale amounts", () => {
  assert.throws(() => activityValues({ ...activity(), funding_option: "Budgeted (Approved Release)" }, { complete: true }), /budget and approved amount/);
  const values = activityValues({ ...activity(), activity_budget: 3000, approved_amount: 2000 }, { complete: true });
  assert.equal(values.activity_budget, null);
  assert.equal(values.approved_amount, null);
});
test("reasons are mandatory for non-conducted, deferred and cancelled activities", () => {
  for (const activity_status of ["Not Conducted", "Deferred", "Cancelled"]) {
    assert.throws(() => activityValues({ ...activity(), activity_status }, { complete: true }), /Explain why/);
    assert.equal(activityValues({ ...activity(), activity_status, status_reason: "Rescheduled by the community" }, { complete: true }).activity_status, activity_status);
  }
});
test("drafts can be incomplete but invalid numbers, references and dates are rejected", () => {
  assert.doesNotThrow(() => activityValues({}));
  assert.throws(() => activityValues({ leads_generated: 1.2 }), /whole number/);
  assert.throws(() => activityValues({ planned_target_audience: -1 }), /whole number/);
  assert.throws(() => activityValues({ activity_date: "2026-02-30" }), /valid activity date/);
  assert.throws(() => activityValues(activity(), { year: 2026, month: 5 }), /reporting month/);
  assert.throws(() => activityValues({ programs_supported: ["invalid programme"] }), /Select valid/);
});
test("multi-select values are deduplicated without multiplying activity counts", () => {
  assert.deepEqual(activityValues({ programs_supported: ["FSSHIP", "FSSHIP", "OPS"] }).programs_supported, ["FSSHIP", "OPS"]);
  const result = totals([{ planned_activities: 10 }], [{ reference_id: "D-1", activity_status: "Not Conducted", status: "submitted", leads_generated: 10 }, { reference_id: "D-2", activity_status: "Completed", leads_generated: 20 }], [{ drive_reference_id: "D-1", category: "enrolment", enrolment_count: 4 }, { drive_reference_id: "D-1", category: "nin_validation", enrolment_count: 100 }, { drive_reference_id: "D-2", category: "enrolment", enrolment_count: 3 }]);
  assert.equal(result.planned, 10);
  assert.equal(result.conducted, 1);
  assert.equal(result.enrolled, 7);
  assert.equal(result.counts.get("D-1"), 4);
});
test("scope is enforced on individual records and zonal roles are not locked to a state", () => {
  assert.throws(() => assertScope({ role: "state-officer", state_code: "ST-1" }, { state_code: "ST-2" }), /Access denied/);
  assert.throws(() => scopeWhere({ role: "state-officer" }), /assigned/);
  assert.deepEqual(scopeWhere({ role: "zonal-coordinator", zonal_code: "ZN-1", state_code: "ST-1" }), { zonal_code: "ZN-1" });
  assert.doesNotThrow(() => assertScope({ role: "sdo" }, { state_code: "ST-2" }));
});
test("review transitions require a different reviewer and do not allow skipping endorsement", () => {
  assert.equal(nextStatus("draft", "send_for_review", { create: true }), "awaiting_review");
  assert.throws(() => nextStatus("draft", "final_submit", { create: true }), /not permitted/);
  assert.throws(() => nextStatus("awaiting_review", "endorse", { review: true, sameOfficer: true }), /not permitted/);
  assert.equal(nextStatus("awaiting_review", "return", { review: true }), "returned");
  assert.equal(nextStatus("returned", "send_for_review", { create: true }), "awaiting_review");
  assert.equal(nextStatus("awaiting_review", "endorse", { review: true }), "endorsed");
  assert.equal(nextStatus("endorsed", "final_submit", { create: true }), "submitted");
  assert.throws(() => nextStatus("submitted", "send_for_review", { create: true }), /not permitted/);
});
test("business references fit existing primary-key columns", () => {
  const ids = new Set(Array.from({ length: 100 }, () => reference("EDAC")));
  assert.equal(ids.size, 100);
  assert([...ids].every((id) => id.length <= 30 && /^EDAC-\d{4}-[A-F0-9]+$/.test(id)));
});
