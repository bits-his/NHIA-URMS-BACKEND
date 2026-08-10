const { Op } = require("sequelize");
const { NhiaAccreditedProvider, StateOffice } = require("../models");

/** Canonical state office code → NHIA provider_code prefix (e.g. OYO → OY/001/P) */
const STATE_CODE_TO_NHIA_PREFIX = {
  JIG: "JG", KAD: "KD", KAN: "KN", KAT: "KT", KEB: "KB", SOK: "SO", ZAM: "ZF",
  ADA: "AD", BAU: "BA", BOR: "BO", GOM: "GM", TAR: "TR", YOB: "YB",
  BEN: "BN", KOG: "KG", KWA: "KW", NAS: "NW", NIG: "NG", PLA: "PL", FCT: "FCT",
  EKI: "EK", LAG: "LA", OGU: "OG", OND: "OD", OSU: "OS", OYO: "OY",
  ABI: "AB", ANA: "AN", EBO: "EB", ENU: "EN", IMO: "IM",
  AKW: "AK", BAY: "BY", CRO: "CR", DEL: "DT", EDO: "ED", RIV: "RV",
};

/** Legacy aliases (SO-XX codes from old SQL seeds) */
const STATE_PREFIX_OVERRIDES = {
  ZAM: "ZF", ABI: "AB", ADA: "AD", AKW: "AK", ANA: "AN", BAU: "BA", BAY: "BY",
  BEN: "BN", BOR: "BO", CRO: "CR", DEL: "DT", EBO: "EB", EDO: "ED", EKI: "EK",
  ENU: "EN", FCT: "FCT", GOM: "GM", IMO: "IM", JIG: "JG", KAD: "KD", KAN: "KN",
  KAT: "KT", KEB: "KB", KOG: "KG", KWA: "KW", LAG: "LA", NAS: "NW", NIG: "NG",
  OGU: "OG", OND: "OD", OSU: "OS", OYO: "OY", PLA: "PL", RIV: "RV", SOK: "SO",
  TAR: "TR", YOB: "YB",
};

/** Map state office descriptions → NHIA provider_code prefix (fallback) */
const STATE_DESCRIPTION_PREFIX = {
  Ondo: "OD", Oyo: "OY", Ogun: "OG", Osun: "OS", Ekiti: "EK",
  Yaba: "LA", Ikeja: "LA", Kaduna: "KD", Kebbi: "KB", Sokoto: "SO",
  Zamfara: "ZF", Jigawa: "JG", Katsina: "KT", Kano: "KN", Kwara: "KW",
  Kogi: "KG", Niger: "NG", Anambra: "AN", Ebonyi: "EB", Imo: "IM",
  Abia: "AB", Enugu: "EN", "Akwa-Ibom": "AK", "Akwa Ibom": "AK", Bayelsa: "BY",
  Edo: "ED", "Cross Rivers": "CR", "Cross River": "CR", Delta: "DT", River: "RV",
  Rivers: "RV", Adamawa: "AD", Borno: "BO", Taraba: "TR", Yobe: "YB",
  Gombe: "GM", Bauchi: "BA", "FCT (Abuja)": "FCT", Abuja: "FCT", Nasarawa: "NW",
  Plateau: "PL", Benue: "BN", Lagos: "LA", Jigawa: "JG", Katsina: "KT",
  Kebbi: "KB", Zamfara: "ZF", Sokoto: "SO",
};

const stateSearchTerms = (description) => {
  const d = description.trim();
  if (d.includes("Abuja") || d === "Abuja") return ["FCT", "ABUJA"];
  return [d, d.toUpperCase()];
};

const resolveNhiaPrefix = async (stateId) => {
  const state = await StateOffice.findByPk(stateId, { attributes: ["id", "code", "description"] });
  if (!state) return null;

  const code = (state.code || "").trim().toUpperCase();
  if (STATE_CODE_TO_NHIA_PREFIX[code]) {
    return { state, prefix: STATE_CODE_TO_NHIA_PREFIX[code] };
  }
  if (STATE_PREFIX_OVERRIDES[code]) {
    return { state, prefix: STATE_PREFIX_OVERRIDES[code] };
  }

  const descPrefix = STATE_DESCRIPTION_PREFIX[state.description?.trim()];
  if (descPrefix) return { state, prefix: descPrefix };

  const terms = stateSearchTerms(state.description || "");
  for (const term of terms) {
    const row = await NhiaAccreditedProvider.findOne({
      where: { provider_type: "hcp", address: { [Op.like]: `%${term}%` } },
      attributes: ["provider_code"],
    });
    const prefix = row?.provider_code?.split("/")?.[0];
    if (prefix) return { state, prefix };
  }

  return { state, prefix: null };
};

const applyStateFilter = async (where, type, stateId) => {
  if (!stateId || type !== "hcp") return null;
  const resolved = await resolveNhiaPrefix(stateId);
  if (!resolved?.prefix) return resolved;
  where.provider_code = { [Op.like]: `${resolved.prefix}/%` };
  return resolved;
};

const applyStateAddressFallback = (where, resolved) => {
  if (!resolved?.state?.description) return;
  const term = `%${resolved.state.description.trim()}%`;
  const addressFilter = {
    [Op.or]: [
      { address: { [Op.like]: term } },
      { name: { [Op.like]: term } },
    ],
  };
  Object.keys(where).forEach((k) => delete where[k]);
  where.provider_type = "hcp";
  where[Op.and] = [addressFilter];
};

module.exports = {
  STATE_CODE_TO_NHIA_PREFIX,
  resolveNhiaPrefix,
  applyStateFilter,
  applyStateAddressFallback,
  stateSearchTerms,
};
