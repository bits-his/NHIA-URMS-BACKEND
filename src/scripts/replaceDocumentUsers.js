require("dotenv").config();
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { User, Role, Department, StateOffice, ZonalOffice } = require("../models");
const { DEFAULT_ROLES } = require("../utils/roleService");
const { DOCUMENT_USER_PROFILES } = require("../utils/documentUserProfiles");

const idsFrom = (value) => value.split(",").map(Number).sort((a, b) => a - b);
const publicAttributes = ["id", "name", "staff_id", "role", "is_active", "state_code", "zonal_code", "department_code", "unit_code"];

async function references(transaction) {
  const [rows] = await sequelize.query("SELECT k.TABLE_NAME AS table_name,k.COLUMN_NAME AS column_name,r.DELETE_RULE AS delete_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME='users'", { transaction });
  const quote = (value) => sequelize.getQueryInterface().quoteIdentifier(value);
  const result = [];
  for (const row of rows) {
    const [counts] = await sequelize.query(`SELECT COUNT(*) AS count FROM ${quote(row.table_name)} t JOIN users u ON t.${quote(row.column_name)}=u.id WHERE u.role<>:admin`, { replacements: { admin: "admin" }, transaction });
    const count = Number(counts[0].count);
    if (count) result.push({ ...row, count });
  }
  return result;
}

function accountPayload(spec, password) {
  return { staff_id: spec.staff_id, name: spec.name, role: spec.role, email: null, password, department_code: spec.department_code, unit_code: null, state_code: spec.report_scope === "state" ? "KAN" : null, zonal_code: ["state", "zonal"].includes(spec.report_scope) ? "NW" : null, is_active: true, functionalities: structuredClone(spec.access) };
}

async function replaceUsers({ apply = false, expectedIds = [] } = {}) {
  assert.equal(DOCUMENT_USER_PROFILES.length, 16);
  assert.equal(new Set(DOCUMENT_USER_PROFILES.map((spec) => spec.staff_id)).size, 16);
  assert.equal(new Set(DOCUMENT_USER_PROFILES.map((spec) => spec.role)).size, 16);
  const before = await User.findAll({ attributes: publicAttributes, order: [["id", "ASC"]], raw: true });
  const admins = before.filter((user) => user.role === "admin");
  assert.equal(admins.length, 1, "Expected the single confirmed administrator");
  assert.equal(admins[0].id, 1);
  assert.equal(admins[0].staff_id, "ADMIN001");
  const oldUsers = before.filter((user) => user.role !== "admin");
  const effects = await references();
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", database: sequelize.config.database, keep: admins, remove_count: oldUsers.length, remove_ids: oldUsers.map((user) => user.id), replacements: DOCUMENT_USER_PROFILES.map((spec) => ({ staff_id: spec.staff_id, name: spec.name, scope: spec.report_scope, can_create: spec.can_create_monthly, can_review: spec.can_review_monthly, access: spec.access })), existing_references: effects }, null, 2));
  if (!apply) return;
  assert.deepEqual(oldUsers.map((user) => user.id), expectedIds, "Existing users differ from the explicitly confirmed deletion list");
  assert.equal(expectedIds.length, 43, "This operation was approved for exactly 43 users");
  assert.equal(effects.reduce((sum, row) => sum + row.count, 0), 12, "Authorship references differ from the confirmed impact; obtain fresh confirmation");
  assert(effects.every((row) => row.delete_rule === "SET NULL"), "Unexpected deletion side effects; nothing has been changed");
  const state = await StateOffice.findByPk("KAN");
  assert.equal(state?.zonal_code, "NW", "Kano/North-West reference data is missing or inconsistent");
  assert(await ZonalOffice.findByPk("NW"));
  for (const code of new Set(DOCUMENT_USER_PROFILES.map((spec) => spec.department_code).filter(Boolean))) assert(await Department.findByPk(code), `Missing department ${code}`);
  const credentials = await Promise.all(DOCUMENT_USER_PROFILES.map(async (spec) => {
    const password = randomBytes(24).toString("base64url");
    return { spec, password, hash: await bcrypt.hash(password, 12) };
  }));
  let credentialPath;
  try {
    await sequelize.transaction(async (transaction) => {
      const locked = await User.findAll({ order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
      assert.deepEqual(locked.filter((user) => user.role !== "admin").map((user) => user.id), expectedIds, "Accounts changed since confirmation");
      const administrator = locked.find((user) => user.id === 1);
      assert.equal(administrator.role, "admin");
      const administratorBefore = administrator.toJSON();
      for (const spec of DOCUMENT_USER_PROFILES) {
        const definition = DEFAULT_ROLES.find((role) => role.key === spec.role);
        assert(definition, `Missing role definition ${spec.role}`);
        const existing = await Role.findOne({ where: { key: spec.role }, transaction, lock: transaction.LOCK.UPDATE });
        if (existing) await existing.update({ ...definition, is_active: true }, { transaction });
        else await Role.create({ ...definition, is_active: true }, { transaction });
      }
      const deleted = await User.destroy({ where: { id: { [Op.in]: expectedIds }, role: { [Op.ne]: "admin" } }, transaction });
      assert.equal(deleted, 43);
      for (const credential of credentials) {
        const account = await User.create(accountPayload(credential.spec, credential.hash), { transaction });
        assert(account.id > Math.max(...expectedIds), "New user IDs must not reuse deleted identities");
        assert(await bcrypt.compare(credential.password, account.password));
      }
      const users = await User.findAll({ attributes: publicAttributes, transaction, order: [["staff_id", "ASC"]], raw: true });
      assert.equal(users.length, 17);
      assert.deepEqual(users.filter((user) => user.role !== "admin").map((user) => user.staff_id).sort(), DOCUMENT_USER_PROFILES.map((spec) => spec.staff_id).sort());
      const administratorAfter = await User.findByPk(1, { transaction });
      assert.deepEqual(administratorAfter.toJSON(), administratorBefore, "Administrator must remain completely unchanged");
      const folder = path.resolve(__dirname, "../../storage/provisioning");
      await fs.mkdir(folder, { recursive: true, mode: 0o700 });
      await fs.chmod(folder, 0o700);
      credentialPath = path.join(folder, `document-users-${Date.now()}-${randomBytes(4).toString("hex")}.csv`);
      const csv = (values) => values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
      const lines = [csv(["Staff ID", "Account name", "Initial password"]), ...credentials.map(({ spec, password }) => csv([spec.staff_id, spec.name, password]))];
      await fs.writeFile(credentialPath, lines.join("\n") + "\n", { flag: "wx", mode: 0o600 });
    });
  } catch (error) {
    if (credentialPath) await fs.unlink(credentialPath);
    throw error;
  }
  console.log(`Replaced 43 users with 16 document accounts. ADMIN001 is unchanged. Initial passwords are stored only in the private file: ${credentialPath}`);
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const argument = process.argv.find((value) => value.startsWith("--expected-user-ids="));
  replaceUsers({ apply, expectedIds: argument ? idsFrom(argument.slice("--expected-user-ids=".length)) : [] })
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => sequelize.close());
}

module.exports = { replaceUsers, accountPayload, idsFrom };
