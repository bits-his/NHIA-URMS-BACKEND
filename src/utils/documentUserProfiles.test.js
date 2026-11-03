const test = require("node:test");
const assert = require("node:assert/strict");
const { DOCUMENT_USER_PROFILES, documentRoleOverrides, canWriteDocumentRequest } = require("./documentUserProfiles");
const { accountPayload, idsFrom } = require("../scripts/replaceDocumentUsers");
const { DEFAULT_ROLES } = require("./roleService");
const { getDefaultAccess } = require("./departmentRoleAccess");
const { canSubmitForms } = require("./monthlyReportScope");
const { scopeWhere } = require("./enrolmentDriveWorkflow");
const { Role } = require("../models");
const sequelize = require("../config/database");

test("the approved document produces exactly sixteen unique logins and keeps admin separate", () => {
  assert.equal(DOCUMENT_USER_PROFILES.length, 16);
  assert.equal(new Set(DOCUMENT_USER_PROFILES.map((row) => row.staff_id)).size, 16);
  assert.equal(new Set(DOCUMENT_USER_PROFILES.map((row) => row.role)).size, 16);
  assert(!DOCUMENT_USER_PROFILES.some((row) => row.role === "admin"));
  for (const id of ["SOCSC-0001", "SOCRO-0001", "SORO-0001", "SOCZC-0001", "ENFZC-0001", "FINZC-0001", "FSDZC-0001"]) assert(DOCUMENT_USER_PROFILES.some((row) => row.staff_id === id));
});

test("account geography follows the confirmed national, Kano and North-West assignments", () => {
  for (const spec of DOCUMENT_USER_PROFILES) {
    const account = accountPayload(spec, "test-hash");
    assert.equal(account.state_code, spec.report_scope === "state" ? "KAN" : null);
    assert.equal(account.zonal_code, spec.report_scope === "national" ? null : "NW");
    assert.equal(account.email, null);
    assert.deepEqual(account.functionalities, spec.access);
    account.functionalities.push({ access_to: "test", functionalities: [] });
    assert(!spec.access.some((entry) => entry.access_to === "test"));
  }
});

test("role reseeding and future account templates retain the documented configuration", () => {
  for (const spec of DOCUMENT_USER_PROFILES) {
    const role = DEFAULT_ROLES.find((row) => row.key === spec.role);
    assert.equal(role.report_scope, spec.report_scope);
    assert.equal(role.can_create_monthly, spec.can_create_monthly);
    assert.equal(role.can_review_monthly, spec.can_review_monthly);
    assert.deepEqual(getDefaultAccess(spec.role), spec.access);
  }
  const admin = { key: "admin", label: "Admin", can_create_monthly: true };
  assert.deepEqual(documentRoleOverrides(admin), admin);
});

test("dashboard-only accounts cannot mutate business resources and annual-only roles stay constrained", () => {
  for (const id of ["DG-0001", "FINZC-0001", "ENFZC-0001", "SOCSC-0001", "SPDSC-0001"]) {
    const spec = DOCUMENT_USER_PROFILES.find((row) => row.staff_id === id);
    assert(canWriteDocumentRequest(spec, "GET", "/api/state-office/enrolment/reports"));
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(canWriteDocumentRequest(spec, method, "/api/state-office/enrolment/reports"), false);
  }
  for (const role of ["state-coordinator", "soc-zonal-coordinator"]) {
    const cfg = { role, role_config: { can_create_monthly: false, can_review_monthly: true } };
    assert(canWriteDocumentRequest(cfg, "PATCH", `/api/state-office/stakeholder/reports/STK-2026-00001/status`));
    assert(canWriteDocumentRequest(cfg, "POST", "/api/annual-reports"));
    assert.equal(canWriteDocumentRequest(cfg, "POST", "/api/state-office/enrolment/reports"), false);
    assert.equal(canWriteDocumentRequest(cfg, "PUT", "/api/admin/users/1"), false);
  }
  // Review-only coordinator can endorse but cannot create new reports
  {
    const sc = { role: "state-coordinator", role_config: { can_create_monthly: false, can_review_monthly: true } };
    assert(canWriteDocumentRequest(sc, "PATCH", "/api/state-office/igr/reports/IGR-1/status"));
    assert.equal(canWriteDocumentRequest(sc, "POST", "/api/state-office/igr/reports"), false);
  }
  // Review-only coordinator: endorse OK, create blocked
  {
    const sc = { role: "state-coordinator", role_config: { can_create_monthly: false, can_review_monthly: true } };
    assert(canWriteDocumentRequest(sc, "PATCH", "/api/state-office/igr/reports/IGR-1/status"));
    assert.equal(canWriteDocumentRequest(sc, "POST", "/api/state-office/igr/reports"), false);
  }
  assert(canWriteDocumentRequest({ role: "admin" }, "DELETE", "/api/admin/users/2"));
  assert(canWriteDocumentRequest({ role: "sdo" }, "POST", "/api/admin/users"));
});

test("a false create flag denies form creation, including when review is also disabled", async (context) => {
  context.mock.method(Role, "findOne", async ({ where }) => DOCUMENT_USER_PROFILES.find((row) => row.role === where.key));
  for (const spec of DOCUMENT_USER_PROFILES) assert.equal(await canSubmitForms(spec.role), spec.can_create_monthly);
  assert.equal(await canSubmitForms("unknown-role"), false);
  assert.equal(await canSubmitForms("admin"), true);
});

test("national directors override legacy zonal role names without requiring a fake zone", () => {
  assert.deepEqual(scopeWhere({ role: "fsd-zonal-coordinator", role_config: { report_scope: "national" } }), {});
  assert.deepEqual(scopeWhere({ role: "soc-zonal-coordinator", zonal_code: "NW", role_config: { report_scope: "zonal" } }), { zonal_code: "NW" });
  assert.deepEqual(scopeWhere({ role: "state-officer", state_code: "KAN", role_config: { report_scope: "state" } }), { state_code: "KAN" });
  assert.throws(() => scopeWhere({ role: "state-officer", role_config: { report_scope: "state" } }), /No state/);
  assert.deepEqual(scopeWhere({ role: "state-coordinator", state_code: "JIG", role_config: { report_scope: "state" } }), { state_code: "JIG" });
  assert.deepEqual(scopeWhere({ role: "state-coordinator", state_code: "JIG", role_config: { report_scope: "national" } }), { state_code: "JIG" });
  assert.deepEqual(scopeWhere({ role: "soc-state-coordinator", role_config: { report_scope: "national" } }), {});
  assert.deepEqual(idsFrom("199,2,158"), [2, 158, 199]);
});

test.after(() => sequelize.close());
