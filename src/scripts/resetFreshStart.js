/**
 * Fresh start: keep org/auth data only, wipe everything else.
 *
 * Keeps (nhia_db2): users, roles, departments, units, zonal_offices, state_offices
 * Clears: all other tables in nhia_db2
 * Clears (nhia_db3): citizen_comment_cards + citizen_comment_card_answers
 * Keeps/reseeds: citizen_comment_card_questions (Q01–Q05)
 *
 *   node src/scripts/resetFreshStart.js
 *   npm run db:reset-fresh-start
 */
require("dotenv").config();
const sequelize = require("../config/database");
const sequelizeCommentCards = require("../config/databaseCommentCards");
const {
  CitizenCommentCard,
  CitizenCommentCardAnswer,
  CitizenCommentCardQuestion,
  COMMENT_CARD_QUESTION_SEED,
} = require("../models/commentCards");

const KEEP_TABLES = new Set([
  "users",
  "roles",
  "departments",
  "units",
  "zonal_offices",
  "state_offices",
]);

async function wipeDatabase(dbName) {
  const { Sequelize } = require("sequelize");
  const conn = new Sequelize({
    dialect: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    database: dbName,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    logging: false,
  });

  try {
    await conn.authenticate();
  } catch (err) {
    console.warn(`⚠  Skipping ${dbName}: ${err.message}`);
    return;
  }

  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE'`,
    { replacements: { db: dbName } },
  );

  const names = tables.map((t) => t.name || t.TABLE_NAME || t.Name).filter(Boolean);
  const toClear = names.filter((name) => !KEEP_TABLES.has(name));
  const kept = names.filter((name) => KEEP_TABLES.has(name));

  console.log(`\n── ${dbName}: ${names.length} tables ──`);
  console.log(`   keep (${kept.length}): ${kept.join(", ") || "(none yet)"}`);
  console.log(`   clear (${toClear.length})`);

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const name of toClear) {
    await conn.query(`TRUNCATE TABLE \`${name}\``);
    console.log(`  cleared ${name}`);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  await conn.close();
}

async function wipeMainDbs() {
  const primary = process.env.DB_NAME || "nhia_db";
  // Also wipe legacy nhia_db if primary is nhia_db2 (common local setup)
  const targets = new Set([primary, "nhia_db", "nhia_db2"]);
  for (const db of targets) {
    await wipeDatabase(db);
  }
}

async function wipeCommentCardDb() {
  const db3 = process.env.DB3_NAME || "nhia_db3";
  try {
    await sequelizeCommentCards.authenticate();
  } catch (err) {
    console.warn(`⚠  Skipping ${db3}: ${err.message}`);
    console.warn("   Run: npm run db:setup-comment-cards");
    return;
  }

  console.log(`\n── ${db3}: clearing comment cards + answers ──`);
  await sequelizeCommentCards.query("SET FOREIGN_KEY_CHECKS = 0");
  await CitizenCommentCardAnswer.destroy({ where: {}, truncate: true, force: true });
  await CitizenCommentCard.destroy({ where: {}, truncate: true, force: true });
  await sequelizeCommentCards.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("  cleared citizen_comment_card_answers");
  console.log("  cleared citizen_comment_cards");

  for (const q of COMMENT_CARD_QUESTION_SEED) {
    const [row, created] = await CitizenCommentCardQuestion.findOrCreate({
      where: { question_id: q.question_id },
      defaults: q,
    });
    if (!created) {
      await row.update({
        section: q.section,
        question: q.question,
        scale: q.scale,
        sort_order: q.sort_order,
      });
    }
  }
  console.log(`  ensured ${COMMENT_CARD_QUESTION_SEED.length} questions (Q01–Q05)`);
}

(async () => {
  try {
    console.log("🧹  Fresh start — org/auth kept; all other data cleared\n");
    await wipeMainDbs();
    await wipeCommentCardDb();
    console.log("\n✅  Done. Kept: users, roles, departments, units, zones, states");
    console.log("    Comment cards empty; questions ready for new submissions.\n");
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  } finally {
    await sequelize.close().catch(() => {});
    await sequelizeCommentCards.close().catch(() => {});
  }
})();
