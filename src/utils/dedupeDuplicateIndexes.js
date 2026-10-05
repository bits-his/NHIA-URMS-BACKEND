/**
 * Sequelize sync({ alter: true }) on MySQL re-adds UNIQUE indexes every run
 * (staff_id, staff_id_2, …) until MySQL hits its 64-index-per-table limit
 * (ER_TOO_MANY_KEYS). Drop duplicate indexes before alter.
 */
async function dedupeDuplicateIndexes(sequelize, { log = false } = {}) {
  const [tables] = await sequelize.query(
    `SELECT TABLE_NAME AS name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  );

  let dropped = 0;

  for (const { name: table } of tables) {
    const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\``);
    /** @type {Map<string, { Key_name: string, Non_unique: number, cols: string[] }[]>} */
    const groups = new Map();

    for (const row of rows) {
      if (row.Key_name === "PRIMARY") continue;
      const g = groups.get(row.Key_name) || {
        Key_name: row.Key_name,
        Non_unique: row.Non_unique,
        cols: [],
      };
      g.cols[row.Seq_in_index - 1] = row.Column_name;
      groups.set(row.Key_name, g);
    }

    /** signature → list of index defs */
    const bySig = new Map();
    for (const idx of groups.values()) {
      const sig = `${idx.Non_unique}|${idx.cols.join(",")}`;
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig).push(idx);
    }

    for (const list of bySig.values()) {
      if (list.length < 2) continue;
      // Prefer plain column name (staff_id) over staff_id_2 / users_staff_id_uk …
      list.sort((a, b) => {
        const score = (n) => (/_\d+$/.test(n) ? 1 : 0) + n.length / 100;
        return score(a.Key_name) - score(b.Key_name);
      });
      const [, ...dupes] = list;
      for (const d of dupes) {
        await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${d.Key_name}\``);
        dropped += 1;
        if (log) console.log(`  ↳ ${table}: dropped duplicate index ${d.Key_name}`);
      }
    }
  }

  return dropped;
}

module.exports = { dedupeDuplicateIndexes };
