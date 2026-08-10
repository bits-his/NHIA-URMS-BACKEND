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
];

const REF_CLEANUP = [
  { table: "servicom_complaints", column: "facility_id", parent: "servicom_facilities" },
  { table: "servicom_complaints", column: "visit_id", parent: "monitoring_visits" },
];

async function fixOrphanForeignKeys(sequelize, { log = false } = {}) {
  let total = 0;

  for (const { table, columns } of GEO_CLEANUP) {
    for (const column of columns) {
      const parent = column === "state_id" ? "state_offices" : "zonal_offices";
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

module.exports = { fixOrphanForeignKeys };
