const OBSERVATION_KEYS = [
  "registration_time",
  "waiting_time",
  "hmo_no_response",
  "nhia_drugs",
  "out_of_stock_alt",
  "no_oop",
  "tariff_conform",
  "communication",
  "nhia_knowledge",
  "complaint_process",
];

const ENROLLEE_KEYS = [
  "registration",
  "waiting",
  "staff_courtesy",
  "doctor_interaction",
  "nhia_drugs",
  "oop_other",
  "discrimination",
  "referral",
  "communication",
  "complaint_resolution",
];

function asScoreMap(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === "object" ? value : {};
}

function sumScores(raw, keys) {
  const obj = asScoreMap(raw);
  let total = 0;
  for (const key of keys) {
    const n = Number(obj[key]);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function computeScores(payload = {}) {
  const standard_expectations_score = sumScores(payload.observations, OBSERVATION_KEYS);
  const enrollee_score_1 = sumScores(payload.enrollee_card_1, ENROLLEE_KEYS);
  const enrollee_score_2 = sumScores(payload.enrollee_card_2, ENROLLEE_KEYS);
  const enrollee_score_3 = sumScores(payload.enrollee_card_3, ENROLLEE_KEYS);
  return {
    standard_expectations_score,
    enrollee_score_1,
    enrollee_score_2,
    enrollee_score_3,
  };
}

module.exports = { OBSERVATION_KEYS, ENROLLEE_KEYS, computeScores, asScoreMap };
