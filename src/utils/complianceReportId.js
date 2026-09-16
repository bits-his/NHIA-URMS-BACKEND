/** Map seeded 3-letter state codes → template 2-letter codes (e.g. KAN → KN). */
const STATE_REF_CODES = {
  JIG: "JI", KAD: "KD", KAN: "KN", KAT: "KT", KEB: "KE", SOK: "SO", ZAM: "ZA",
  ADA: "AD", BAU: "BA", BOR: "BO", GOM: "GO", TAR: "TA", YOB: "YO",
  BEN: "BE", KOG: "KO", KWA: "KW", NAS: "NA", NIG: "NI", PLA: "PL", FCT: "FC",
  EKI: "EK", LAG: "LA", OGU: "OG", OND: "ON", OSU: "OS", OYO: "OY",
  ABI: "AB", ANA: "AN", EBO: "EB", ENU: "EN", IMO: "IM",
  AKW: "AK", BAY: "BY", CRO: "CR", DEL: "DE", EDO: "ED", RIV: "RI",
};

function refStateCode(state) {
  const code = String(state?.code || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (STATE_REF_CODES[code]) return STATE_REF_CODES[code];
  if (code.length === 2) return code;
  if (code.length >= 2) return code.slice(0, 2);
  return "ST";
}

/** KN/ABCH or ABCH → ABCH (facility token used in KN-ABCH-2026-W27). */
function refFacilityCode(facilityCode) {
  const parts = String(facilityCode || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const token = parts[parts.length - 1] || "FAC";
  return token.slice(0, 8) || "FAC";
}

function formatComplianceReportId(state, facilityCode, year, week) {
  const st = refStateCode(state);
  const fac = refFacilityCode(facilityCode);
  const y = Number(year) || new Date().getFullYear();
  const w = String(Number(week) || 1).padStart(2, "0");
  return `${st}-${fac}-${y}-W${w}`;
}

module.exports = { STATE_REF_CODES, refStateCode, refFacilityCode, formatComplianceReportId };
