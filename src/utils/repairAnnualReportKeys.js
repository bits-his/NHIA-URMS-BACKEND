/**
 * Repair missing PRIMARY KEYs that block Sequelize FK creation (errno 150).
 * Some production tables were created without indexes.
 */
async function repairAnnualReportKeys(sequelize, { log = console.log } = {}) {
  const qi = async (sql, replacements) => {
    const [rows] = await sequelize.query(sql, replacements ? { replacements } : undefined);
    return rows;
  };

  const tableExists = async (table) => {
    const rows = await qi(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table`,
      { table }
    );
    return Number(rows[0].cnt) > 0;
  };

  const ensurePrimaryKey = async (table, column, { autoIncrement = false } = {}) => {
    if (!(await tableExists(table))) return;
    const indexes = await qi(`SHOW INDEX FROM \`${table}\``);
    if (indexes.some((i) => i.Key_name === "PRIMARY")) {
      log(`⏭   ${table} already has PRIMARY KEY`);
      return;
    }
    const dupes = await qi(
      `SELECT \`${column}\` AS v, COUNT(*) AS cnt FROM \`${table}\`
       GROUP BY \`${column}\` HAVING cnt > 1`
    );
    if (dupes.length) {
      throw new Error(
        `Cannot add PRIMARY KEY on ${table}.${column} — duplicate values exist`
      );
    }
    if (autoIncrement) {
      await sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY \`${column}\` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (\`${column}\`)`
      );
    } else {
      await sequelize.query(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (\`${column}\`)`);
    }
    log(`✅  Added PRIMARY KEY on ${table}.${column}`);
  };

  await ensurePrimaryKey("zonal_offices", "id", { autoIncrement: true });
  await ensurePrimaryKey("state_offices", "id", { autoIncrement: true });
  await ensurePrimaryKey("departments", "id", { autoIncrement: true });
  await ensurePrimaryKey("units", "id", { autoIncrement: true });
  await ensurePrimaryKey("annual_reports", "reference_id");
  await ensurePrimaryKey("quarterly_data", "id", { autoIncrement: true });

  if (await tableExists("quarterly_data")) {
    const fkRows = await qi(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'quarterly_data'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
    );
    if (!fkRows.length) {
      try {
        await sequelize.query(
          `ALTER TABLE \`quarterly_data\`
           ADD CONSTRAINT \`quarterly_data_annual_report_ref_fkey\`
           FOREIGN KEY (\`annual_report_ref\`) REFERENCES \`annual_reports\` (\`reference_id\`)
           ON DELETE CASCADE ON UPDATE CASCADE`
        );
        log("✅  Added FK quarterly_data.annual_report_ref → annual_reports.reference_id");
      } catch (err) {
        log(`⚠️   Could not add quarterly_data FK — ${String(err.message || err).split("\n")[0]}`);
      }
    } else {
      log("⏭   quarterly_data foreign key already present");
    }
  }
}

module.exports = { repairAnnualReportKeys };
