/**
 * Weekly Compliance indicator catalog — keep in sync with FE weeklyComplianceConfig.ts
 */

const INDICATORS = [
  { section_key: "service_delivery", indicator_key: "services_without_denial" },
  { section_key: "service_delivery", indicator_key: "illegal_copayments" },
  { section_key: "service_delivery", indicator_key: "benefit_package_adhered" },
  { section_key: "service_delivery", indicator_key: "emergency_without_authorization" },
  { section_key: "service_delivery", indicator_key: "referral_protocols_followed" },
  { section_key: "medicines", indicator_key: "prescribed_medicines_available" },
  { section_key: "medicines", indicator_key: "nhia_medicines_list_used" },
  { section_key: "medicines", indicator_key: "stockout_alternative" },
  { section_key: "provider_hmo", indicator_key: "timely_claims_submission" },
  { section_key: "provider_hmo", indicator_key: "prompt_payment_receipt" },
  { section_key: "provider_hmo", indicator_key: "hmo_disputes" },
];

const SECTION_BY_KEY = Object.fromEntries(
  INDICATORS.map((i) => [i.indicator_key, i.section_key]),
);

function sectionFor(indicatorKey) {
  return SECTION_BY_KEY[indicatorKey] || null;
}

module.exports = {
  INDICATORS,
  SECTION_BY_KEY,
  sectionFor,
};
