/**
 * Clear geo FK columns that reference missing parent rows.
 * Required before sequelize.sync({ alter: true }) when legacy data used
 * state/zone IDs that no longer exist in state_offices / zonal_offices.
 * Nullable columns are nulled; NOT NULL columns delete the orphan child rows.
 */

function rowField(row, ...names) {
  if (!row) return undefined;
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name];
    const lower = name.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
  }
  return undefined;
}

async function tableExists(sequelize, table) {
  const [meta] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] },
  );
  return Number(rowField(meta[0], "cnt", "CNT")) > 0;
}

async function columnMeta(sequelize, table, column) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column] },
  );
  const raw = rows[0];
  if (!raw) return null;
  return {
    COLUMN_TYPE: rowField(raw, "COLUMN_TYPE", "column_type"),
    IS_NULLABLE: String(rowField(raw, "IS_NULLABLE", "is_nullable") || "").toUpperCase(),
    COLUMN_DEFAULT: rowField(raw, "COLUMN_DEFAULT", "column_default"),
  };
}

/**
 * Delete rows in child tables that reference orphan parents we're about to remove.
 * Uses information_schema so we don't miss stock_verification_items, etc.
 */
async function deleteChildrenOfOrphans(sequelize, table, column, parentTable) {
  const [fks] = await sequelize.query(
    `SELECT DISTINCT k.TABLE_NAME AS childTable, k.COLUMN_NAME AS childColumn
     FROM information_schema.KEY_COLUMN_USAGE k
     WHERE k.TABLE_SCHEMA = DATABASE()
       AND k.REFERENCED_TABLE_NAME = ?
       AND k.REFERENCED_COLUMN_NAME = 'id'
       AND k.TABLE_NAME <> ?`,
    { replacements: [table, table] },
  );

  for (const fk of fks || []) {
    const childTable = rowField(fk, "childTable", "TABLE_NAME", "table_name");
    const childColumn = rowField(fk, "childColumn", "COLUMN_NAME", "column_name");
    if (!childTable || !childColumn) continue;
    await sequelize.query(
      `DELETE c FROM \`${childTable}\` c
       INNER JOIN \`${table}\` t ON c.\`${childColumn}\` = t.id
       LEFT JOIN \`${parentTable}\` p ON t.\`${column}\` = p.id
       WHERE t.\`${column}\` IS NOT NULL AND p.id IS NULL`,
    );
  }

  // Hard-coded fallback when FK metadata is missing (common on partially migrated DBs)
  if (table === "stock_verifications" && (await tableExists(sequelize, "stock_verification_items"))) {
    await sequelize.query(
      `DELETE i FROM stock_verification_items i
       INNER JOIN stock_verifications v ON i.verification_id = v.id
       LEFT JOIN \`${parentTable}\` p ON v.\`${column}\` = p.id
       WHERE v.\`${column}\` IS NOT NULL AND p.id IS NULL`,
    );
  }
  if (table === "monitoring_visits" && (await tableExists(sequelize, "servicom_complaints"))) {
    await sequelize.query(
      `UPDATE servicom_complaints c
       INNER JOIN monitoring_visits v ON c.visit_id = v.id
       LEFT JOIN \`${parentTable}\` p ON v.\`${column}\` = p.id
       SET c.visit_id = NULL
       WHERE v.\`${column}\` IS NOT NULL AND p.id IS NULL`,
    );
  }
}

async function nullOrphanColumn(sequelize, table, column, parentTable) {
  if (!(await tableExists(sequelize, table))) return { cleared: 0, deleted: 0 };

  const col = await columnMeta(sequelize, table, column);
  if (!col) return { cleared: 0, deleted: 0 };

  if (col.IS_NULLABLE !== "YES") {
    await deleteChildrenOfOrphans(sequelize, table, column, parentTable);
    const [, result] = await sequelize.query(
      `DELETE t FROM \`${table}\` t
       LEFT JOIN \`${parentTable}\` p ON t.\`${column}\` = p.id
       WHERE t.\`${column}\` IS NOT NULL AND p.id IS NULL`,
    );
    return { cleared: 0, deleted: result?.affectedRows ?? 0 };
  }

  const [, result] = await sequelize.query(
    `UPDATE \`${table}\` t
     LEFT JOIN \`${parentTable}\` p ON t.\`${column}\` = p.id
     SET t.\`${column}\` = NULL
     WHERE t.\`${column}\` IS NOT NULL AND p.id IS NULL`,
  );
  return { cleared: result?.affectedRows ?? 0, deleted: 0 };
}

/** Tables/columns that get FK constraints via Sequelize associations. */
const GEO_CLEANUP = [
  { table: "servicom_complaints", columns: ["state_id", "zone_id"] },
  { table: "servicom_satisfaction_surveys", columns: ["state_id", "zone_id"] },
  { table: "servicom_comment_cards", columns: ["state_id", "zone_id"] },
  { table: "monitoring_visits", columns: ["state_id", "zone_id"] },
  { table: "servicom_facilities", columns: ["state_id", "zone_id"] },
  { table: "supply_verifications", columns: ["state_id", "zone_id"] },
  { table: "stock_verifications", columns: ["state_id", "zone_id"] },
  { table: "stock_assets", columns: ["state_id", "zone_id"] },
  { table: "physical_asset_verifications", columns: ["state_id", "zone_id"] },
  { table: "state_zonal_office_profiles", columns: ["state_id", "zone_id"] },
  { table: "state_zonal_focal_persons", columns: ["state_id", "zone_id"] },
  { table: "state_office_mystery_shopping", columns: ["state_id", "zone_id"] },
  { table: "state_office_hmo_indebtedness", columns: ["state_id", "zone_id"] },
  { table: "state_office_compliance_visits", columns: ["state_id", "zone_id"] },
  { table: "state_office_reconciliation_meetings", columns: ["state_id", "zone_id"] },
  { table: "state_office_complaints", columns: ["state_id", "zone_id"] },
  { table: "hcf_facilities", columns: ["state_id", "zone_id"] },
  { table: "admin_hr_reports", columns: ["state_id", "zone_id"] },
  { table: "users", columns: ["state_id", "zone_id"] },
];

/** Discover extra tables with state_id / zone_id so sync doesn't fail on missed models. */
async function discoverGeoTables(sequelize) {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT table_name AS tableName, column_name AS columnName
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND column_name IN ('state_id', 'zone_id')
       AND table_name NOT IN ('state_offices', 'zonal_offices')`,
  );
  const byTable = new Map();
  for (const row of rows) {
    const table = rowField(row, "tableName", "TABLE_NAME", "tablename");
    const column = rowField(row, "columnName", "COLUMN_NAME", "columnname");
    if (!table || !column) continue;
    if (!byTable.has(table)) byTable.set(table, new Set());
    byTable.get(table).add(column);
  }
  return [...byTable.entries()].map(([table, cols]) => ({
    table,
    columns: [...cols],
  }));
}

function mergeGeoCleanup(discovered) {
  const map = new Map();
  for (const entry of [...GEO_CLEANUP, ...discovered]) {
    if (!map.has(entry.table)) map.set(entry.table, new Set());
    entry.columns.forEach((c) => map.get(entry.table).add(c));
  }
  return [...map.entries()].map(([table, cols]) => ({
    table,
    columns: [...cols],
  }));
}

/** Child INT columns that must match parent PK signedness before ALTER TABLE ADD FOREIGN KEY. */
const FK_TYPE_ALIGN = [
  { table: "supply_verifications", column: "zone_id", parent: "zonal_offices" },
  { table: "supply_verifications", column: "state_id", parent: "state_offices" },
  { table: "supply_verifications", column: "department_id", parent: "departments" },
  { table: "supply_verifications", column: "unit_id", parent: "units" },
  { table: "stock_verifications", column: "zone_id", parent: "zonal_offices" },
  { table: "stock_verifications", column: "state_id", parent: "state_offices" },
  { table: "stock_verifications", column: "department_id", parent: "departments" },
  { table: "stock_verifications", column: "unit_id", parent: "units" },
  { table: "stock_assets", column: "zone_id", parent: "zonal_offices" },
  { table: "stock_assets", column: "state_id", parent: "state_offices" },
  { table: "stock_assets", column: "unit_id", parent: "units" },
];

const REF_CLEANUP = [
  { table: "servicom_complaints", column: "facility_id", parent: "servicom_facilities" },
  { table: "servicom_complaints", column: "visit_id", parent: "monitoring_visits" },
  { table: "users", column: "department_id", parent: "departments" },
  { table: "users", column: "unit_id", parent: "units" },
  { table: "supply_verifications", column: "department_id", parent: "departments" },
  { table: "supply_verifications", column: "unit_id", parent: "units" },
  { table: "stock_verifications", column: "department_id", parent: "departments" },
  { table: "stock_verifications", column: "unit_id", parent: "units" },
  { table: "stock_assets", column: "unit_id", parent: "units" },
  { table: "store_assets", column: "department_id", parent: "departments" },
  { table: "store_assets", column: "unit_id", parent: "units" },
  { table: "physical_asset_verifications", column: "department_id", parent: "departments" },
  { table: "physical_asset_verifications", column: "unit_id", parent: "units" },
];

/**
 * Orphan child rows that cannot be nulled (NOT NULL FK) must be deleted
 * before sequelize.sync({ alter: true }) can add the constraint.
 */
const ORPHAN_DELETE = [
  { table: "units", column: "department_id", parent: "departments" },
];

function parentTableForColumn(column) {
  if (column === "state_id") return "state_offices";
  if (column === "department_id") return "departments";
  if (column === "unit_id") return "units";
  return "zonal_offices";
}

function isUnsignedInt(columnType) {
  return /\bunsigned\b/i.test(String(columnType || ""));
}

function isIntFamily(columnType) {
  return /\b(tinyint|smallint|mediumint|int|bigint)\b/i.test(String(columnType || ""));
}

/**
 * MySQL rejects FKs when child INT is signed and parent PK is UNSIGNED (ER_FK_INCOMPATIBLE_COLUMNS).
 * Sequelize alter often adds the constraint before it rewrites the column type.
 */
async function alignIntegerFkColumn(sequelize, table, column, parentTable) {
  if (!(await tableExists(sequelize, table))) return false;

  const child = await columnMeta(sequelize, table, column);
  const parent = await columnMeta(sequelize, parentTable, "id");
  if (!child || !parent) return false;
  if (!isIntFamily(child.COLUMN_TYPE) || !isIntFamily(parent.COLUMN_TYPE)) return false;
  if (isUnsignedInt(child.COLUMN_TYPE) === isUnsignedInt(parent.COLUMN_TYPE)) return false;

  if (child.IS_NULLABLE === "YES") {
    await sequelize.query(
      `UPDATE \`${table}\` SET \`${column}\` = NULL WHERE \`${column}\` < 0`,
    );
  }

  const nullable = child.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL";
  const unsigned = isUnsignedInt(parent.COLUMN_TYPE) ? "UNSIGNED" : "";
  await sequelize.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` INT ${unsigned} ${nullable}`.replace(/\s+/g, " "),
  );
  return true;
}

async function alignIntegerForeignKeys(sequelize, { log = false } = {}) {
  let changed = 0;
  for (const spec of FK_TYPE_ALIGN) {
    const ok = await alignIntegerFkColumn(sequelize, spec.table, spec.column, spec.parent);
    if (ok) {
      changed += 1;
      if (log) console.log(`  ↳ ${spec.table}.${spec.column}: aligned INT type to ${spec.parent}.id`);
    }
  }
  return changed;
}

async function deleteOrphanRows(sequelize, table, column, parentTable) {
  if (!(await tableExists(sequelize, table))) return 0;

  const col = await columnMeta(sequelize, table, column);
  if (!col) return 0;

  // Clear nullable FKs that point at rows we're about to delete (e.g. users.unit_id)
  if (table === "units") {
    await sequelize.query(
      `UPDATE users u
       INNER JOIN units un ON u.unit_id = un.id
       LEFT JOIN departments d ON un.department_id = d.id
       SET u.unit_id = NULL
       WHERE un.department_id IS NOT NULL AND d.id IS NULL`,
    );
  }

  await deleteChildrenOfOrphans(sequelize, table, column, parentTable);

  const [, result] = await sequelize.query(
    `DELETE t FROM \`${table}\` t
     LEFT JOIN \`${parentTable}\` p ON t.\`${column}\` = p.id
     WHERE t.\`${column}\` IS NOT NULL AND p.id IS NULL`,
  );
  return result?.affectedRows ?? 0;
}

async function runGeoAndRefCleanup(sequelize, { log = false } = {}) {
  let total = 0;
  const discovered = await discoverGeoTables(sequelize);
  const geoTargets = mergeGeoCleanup(discovered);

  for (const { table, columns } of geoTargets) {
    for (const column of columns) {
      const parent = parentTableForColumn(column);
      const { cleared, deleted } = await nullOrphanColumn(sequelize, table, column, parent);
      if (cleared && log) console.log(`  ↳ ${table}.${column}: cleared ${cleared} orphan row(s)`);
      if (deleted && log) console.log(`  ↳ ${table}.${column}: deleted ${deleted} orphan row(s)`);
      total += cleared + deleted;
    }
  }

  for (const { table, column, parent } of REF_CLEANUP) {
    const { cleared, deleted } = await nullOrphanColumn(sequelize, table, column, parent);
    if (cleared && log) console.log(`  ↳ ${table}.${column}: cleared ${cleared} orphan row(s)`);
    if (deleted && log) console.log(`  ↳ ${table}.${column}: deleted ${deleted} orphan row(s)`);
    total += cleared + deleted;
  }

  for (const { table, column, parent } of ORPHAN_DELETE) {
    const n = await deleteOrphanRows(sequelize, table, column, parent);
    if (n && log) console.log(`  ↳ ${table}.${column}: deleted ${n} orphan row(s)`);
    total += n;
  }

  return total;
}

async function fixOrphanForeignKeys(sequelize, { log = false } = {}) {
  // Temporarily disable checks so child-row deletes can't block parent orphan cleanup
  // on partially migrated schemas where FK metadata / ON DELETE behavior is inconsistent.
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
  let total = 0;
  try {
    total += await runGeoAndRefCleanup(sequelize, { log });
    // Second pass after first deletes may free nested refs
    total += await runGeoAndRefCleanup(sequelize, { log: false });
  } finally {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  }
  return total;
}

module.exports = { fixOrphanForeignKeys, alignIntegerForeignKeys };
