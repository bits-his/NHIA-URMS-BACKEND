/**
 * Null out geo FK columns that reference missing parent rows.
 * Required before sequelize.sync({ alter: true }) when legacy data used
 * state/zone IDs that no longer exist in state_offices / zonal_offices.
 */
async function nullOrphanColumn(sequelize, table, column, parentTable) {
  const [meta] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] },
  );
  if (!Number(meta[0]?.cnt)) return 0;

  const [cols] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column] },
  );
  if (!Number(cols[0]?.cnt)) return 0;

  const [, result] = await sequelize.query(
    `UPDATE \`${table}\` t
     LEFT JOIN \`${parentTable}\` p ON t.\`${column}\` = p.id
     SET t.\`${column}\` = NULL
     WHERE t.\`${column}\` IS NOT NULL AND p.id IS NULL`,
  );
  return result?.affectedRows ?? 0;
}

/** Tables/columns that get FK constraints via Sequelize associations. */
const GEO_CLEANUP = [
  { table: "servicom_complaints", columns: ["state_id", "zone_id"] },
  { table: "servicom_satisfaction_surveys", columns: ["state_id", "zone_id"] },
  { table: "servicom_comment_cards", columns: ["state_id", "zone_id"] },
  { table: "monitoring_visits", columns: ["state_id", "zone_id"] },
  { table: "servicom_facilities", columns: ["state_id", "zone_id"] },
  { table: "supply_verifications", columns: ["state_id", "zone_id"] },
  { table: "state_zonal_office_profiles", columns: ["state_id", "zone_id"] },
  { table: "state_zonal_focal_persons", columns: ["state_id", "zone_id"] },
  { table: "state_office_mystery_shopping", columns: ["state_id", "zone_id"] },
  { table: "state_office_hmo_indebtedness", columns: ["state_id", "zone_id"] },
];

/** Child INT columns that must match parent PK signedness before ALTER TABLE ADD FOREIGN KEY. */
const FK_TYPE_ALIGN = [
  { table: "supply_verifications", column: "zone_id", parent: "zonal_offices" },
  { table: "supply_verifications", column: "state_id", parent: "state_offices" },
  { table: "supply_verifications", column: "department_id", parent: "departments" },
  { table: "supply_verifications", column: "unit_id", parent: "units" },
];

const REF_CLEANUP = [
  { table: "servicom_complaints", column: "facility_id", parent: "servicom_facilities" },
  { table: "servicom_complaints", column: "visit_id", parent: "monitoring_visits" },
];

function parentTableForColumn(column) {
  if (column === "state_id") return "state_offices";
  if (column === "department_id") return "departments";
  if (column === "unit_id") return "units";
  return "zonal_offices";
}

async function columnMeta(sequelize, table, column) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column] },
  );
  return rows[0] || null;
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
  const [tableRows] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] },
  );
  if (!Number(tableRows[0]?.cnt)) return false;

  const child = await columnMeta(sequelize, table, column);
  const parent = await columnMeta(sequelize, parentTable, "id");
  if (!child || !parent) return false;
  if (!isIntFamily(child.COLUMN_TYPE) || !isIntFamily(parent.COLUMN_TYPE)) return false;
  if (isUnsignedInt(child.COLUMN_TYPE) === isUnsignedInt(parent.COLUMN_TYPE)) return false;

  await sequelize.query(
    `UPDATE \`${table}\` SET \`${column}\` = NULL WHERE \`${column}\` < 0`,
  );

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

async function fixOrphanForeignKeys(sequelize, { log = false } = {}) {
  let total = 0;

  for (const { table, columns } of GEO_CLEANUP) {
    for (const column of columns) {
      const parent = parentTableForColumn(column);
      const n = await nullOrphanColumn(sequelize, table, column, parent);
      if (n && log) console.log(`  ↳ ${table}.${column}: cleared ${n} orphan row(s)`);
      total += n;
    }
  }

  for (const { table, column, parent } of REF_CLEANUP) {
    const n = await nullOrphanColumn(sequelize, table, column, parent);
    if (n && log) console.log(`  ↳ ${table}.${column}: cleared ${n} orphan row(s)`);
    total += n;
  }

  return total;
}

module.exports = { fixOrphanForeignKeys, alignIntegerForeignKeys };
