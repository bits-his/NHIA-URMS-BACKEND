const RATING_BANDS = [
  { min: 85, key: "fully_compliant",        label: "Fully Compliant" },
  { min: 70, key: "substantially_compliant", label: "Substantially Compliant" },
  { min: 50, key: "partially_compliant",     label: "Partially Compliant" },
  { min: 0,  key: "non_compliant",           label: "Non-Compliant" },
];

function computeAssessmentScores(scores = []) {
  const valid = scores.filter((s) => s >= 1 && s <= 5);
  if (!valid.length) {
    return { total_score: 0, percentage_score: 0, compliance_rating: null, compliance_label: null };
  }
  const total = valid.reduce((sum, n) => sum + n, 0);
  const max = valid.length * 5;
  const percentage = Math.round((total / max) * 1000) / 10;
  const band = RATING_BANDS.find((b) => percentage >= b.min) || RATING_BANDS[RATING_BANDS.length - 1];
  return {
    total_score: total,
    percentage_score: percentage,
    compliance_rating: band.key,
    compliance_label: band.label,
  };
}

function computeKpiMetrics(kpi = {}) {
  const received = Number(kpi.complaints_received) || 0;
  const resolved = Number(kpi.complaints_resolved) || 0;
  const resolution_rate = received > 0 ? Math.round((resolved / received) * 1000) / 10 : null;
  const compliance_rate = kpi.facilities_meeting_standards != null && kpi.enrollees_served
    ? Math.round((Number(kpi.facilities_meeting_standards) / Number(kpi.enrollees_served)) * 1000) / 10
    : null;
  const satisfaction = Number(kpi.beneficiary_satisfaction_rate);
  const performance_score = satisfaction
    ? Math.round(satisfaction * 10) / 10
    : resolution_rate;
  return { resolution_rate, compliance_rate, performance_score };
}

module.exports = { RATING_BANDS, computeAssessmentScores, computeKpiMetrics };
