/**
 * Citizens' Comment Card models on nhia_db3 (dedicated DB).
 */
const CitizenCommentCard = require("./CitizenCommentCard");
const CitizenCommentCardQuestion = require("./CitizenCommentCardQuestion");
const CitizenCommentCardAnswer = require("./CitizenCommentCardAnswer");

CitizenCommentCard.hasMany(CitizenCommentCardAnswer, {
  foreignKey: "comment_card_id",
  as: "answers",
  onDelete: "CASCADE",
});
CitizenCommentCardAnswer.belongsTo(CitizenCommentCard, {
  foreignKey: "comment_card_id",
  as: "comment_card",
});

CitizenCommentCardQuestion.hasMany(CitizenCommentCardAnswer, {
  foreignKey: "question_id",
  as: "answers",
});
CitizenCommentCardAnswer.belongsTo(CitizenCommentCardQuestion, {
  foreignKey: "question_id",
  as: "question",
});

/** Fixed charter questions seeded into citizen_comment_card_questions. */
const COMMENT_CARD_QUESTION_SEED = [
  {
    question_id: "Q01",
    section: "Reception",
    question: "How would you rate the quality of service received at our reception?",
    scale: "5",
    sort_order: 1,
  },
  {
    question_id: "Q02",
    section: "Front Desk Staff",
    question: "Front desk staff are courteous & polite",
    scale: "4",
    sort_order: 2,
  },
  {
    question_id: "Q03",
    section: "Front Desk Staff",
    question: "Front desk staff are professional & well-informed",
    scale: "4",
    sort_order: 3,
  },
  {
    question_id: "Q04",
    section: "Front Desk Staff",
    question: "Front desk staff are prompt & efficient",
    scale: "4",
    sort_order: 4,
  },
  {
    question_id: "Q05",
    section: "Overall",
    question: "Overall rating of the quality of service / interaction within our organisation",
    scale: "5",
    sort_order: 5,
  },
];

const ANSWER_INCLUDE = [
  {
    model: CitizenCommentCardAnswer,
    as: "answers",
    include: [
      {
        model: CitizenCommentCardQuestion,
        as: "question",
        attributes: ["question_id", "section", "question", "scale", "sort_order"],
      },
    ],
  },
];

/** Shape a card row into the API payload the frontend already expects. */
function serializeCommentCard(row) {
  const json = row?.toJSON ? row.toJSON() : { ...row };
  const answers = Array.isArray(json.answers) ? json.answers : [];
  const responses = answers
    .slice()
    .sort((a, b) => {
      const ao = a.question?.sort_order ?? 0;
      const bo = b.question?.sort_order ?? 0;
      return ao - bo;
    })
    .map((a) => ({
      question_id: a.question_id,
      section: a.question?.section || null,
      question: a.question?.question || null,
      response: a.response,
      score: a.score != null ? Number(a.score) : null,
    }));

  delete json.answers;

  return {
    ...json,
    responses,
    state: json.state_id
      ? { id: json.state_id, description: json.state_name || null }
      : null,
    zone: json.zone_id
      ? { id: json.zone_id, description: json.zone_name || null }
      : null,
  };
}

async function replaceCommentCardAnswers(commentCardId, responses, transaction) {
  await CitizenCommentCardAnswer.destroy({
    where: { comment_card_id: commentCardId },
    transaction,
  });
  const rows = (Array.isArray(responses) ? responses : [])
    .filter((r) => r.response != null && r.response !== "" && r.score != null)
    .map((r) => ({
      comment_card_id: commentCardId,
      question_id: r.question_id,
      response: String(r.response),
      score: Number(r.score),
    }));
  if (rows.length) {
    await CitizenCommentCardAnswer.bulkCreate(rows, { transaction });
  }
}

module.exports = {
  CitizenCommentCard,
  CitizenCommentCardQuestion,
  CitizenCommentCardAnswer,
  COMMENT_CARD_QUESTION_SEED,
  ANSWER_INCLUDE,
  serializeCommentCard,
  replaceCommentCardAnswers,
};
