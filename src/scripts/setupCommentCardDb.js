/**
 * Create nhia_db3 and Citizens' Comment Card tables only.
 *
 *   node src/scripts/setupCommentCardDb.js
 *   npm run db:setup-comment-cards
 */
require("dotenv").config();
const { Sequelize } = require("sequelize");
const sequelizeCommentCards = require("../config/databaseCommentCards");
const {
  CitizenCommentCard,
  CitizenCommentCardQuestion,
  CitizenCommentCardAnswer,
  COMMENT_CARD_QUESTION_SEED,
} = require("../models/commentCards");

const dbName = process.env.DB3_NAME || "nhia_db3";

async function ensureDatabase() {
  const admin = new Sequelize({
    dialect: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    logging: false,
  });
  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`✅  Database ready: ${dbName}`);
  } finally {
    await admin.close();
  }
}

async function seedQuestions() {
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
  console.log(`✅  Seeded ${COMMENT_CARD_QUESTION_SEED.length} comment-card questions`);
}

(async () => {
  try {
    await ensureDatabase();
    await sequelizeCommentCards.authenticate();
    console.log("Syncing citizen_comment_card_questions…");
    await CitizenCommentCardQuestion.sync();
    console.log("Syncing citizen_comment_cards…");
    await CitizenCommentCard.sync();
    console.log("Syncing citizen_comment_card_answers…");
    await CitizenCommentCardAnswer.sync();
    await seedQuestions();
    console.log("✅  nhia_db3 Citizens' Comment Card schema ready");
    process.exit(0);
  } catch (err) {
    console.error("❌  Failed:", err.message);
    process.exit(1);
  } finally {
    await sequelizeCommentCards.close().catch(() => {});
  }
})();
