const { Op } = require("sequelize");
const { NhiaAccreditedProvider, StateOffice } = require("../models");

const STATE_PREFIX_OVERRIDES = {
  ZAM: "ZF", ABI: "AB", ADA: "AD", AKW: "AK", ANA: "AN", BAU: "BA", BAY: "BY",
  BEN: "BN", BOR: "BO", CRO: "CR", DEL: "DT", EBO: "EB", EDO: "ED", EKI: "EK",
  ENU: "EN", FCT: "FCT", GOM: "GM", IMO: "IM", JIG: "JG", KAD: "KD", KAN: "KN",
  KAT: "KT", KEB: "KB", KOG: "KG", KWA: "KW", LAG: "LA", NAS: "NW", NIG: "NG",
  OGU: "OG", OND: "OD", OSU: "OS", OYO: "OY", PLA: "PL", RIV: "RV", SOK: "SO",
  TAR: "TR", YOB: "YB",
};

/** Map state office descriptions → NHIA provider_code prefix */
const STATE_DESCRIPTION_PREFIX = {
  Ondo: "OD", Oyo: "OY", Ogun: "OG", Osun: "OS", Ekiti: "EK",
  Yaba: "LA", Ikeja: "LA", Kaduna: "KD", Kebbi: "KB", Sokoto: "SO",
  Zamfara: "ZF", Jigawa: "JG", Katsina: "KT", Kano: "KN", Kwara: "KW",
  Kogi: "KG", Niger: "NG", Anambra: "AN", Ebonyi: "EB", Imo: "IM",
  Abia: "AB", Enugu: "EN", "Akwa-Ibom": "AK", "Akwa Ibom": "AK", Bayelsa: "BY",
  Edo: "ED", "Cross Rivers": "CR", "Cross River": "CR", Delta: "DT", River: "RV",
  Rivers: "RV", Adamawa: "AD", Borno: "BO", Taraba: "TR", Yobe: "YB",
  Gombe: "GM", Bauchi: "BA", "FCT (Abuja)": "FCT", Abuja: "FCT", Nasarawa: "NW",
  Plateau: "PL", Benue: "BN", Lagos: "LA",
};

const stateSearchTerms = (description) => {
  const d = description.trim();
  if (d.includes("Abuja") || d === "Abuja") return ["FCT", "ABUJA"];
  return [d, d.toUpperCase()];
};

const resolveNhiaPrefix = async (stateId) => {
  const state = await StateOffice.findByPk(stateId, { attributes: ["id", "code", "description"] });
  if (!state) return null;

  if (STATE_PREFIX_OVERRIDES[state.code]) {
    return { state, prefix: STATE_PREFIX_OVERRIDES[state.code] };
  }

  const descPrefix = STATE_DESCRIPTION_PREFIX[state.description?.trim()];
  if (descPrefix) return { state, prefix: descPrefix };

  const terms = stateSearchTerms(state.description);
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
  if (!stateId || type !== "hcp") return;
  const resolved = await resolveNhiaPrefix(stateId);
  if (!resolved?.prefix) return;
  where.provider_code = { [Op.like]: `${resolved.prefix}/%` };
};

module.exports = { resolveNhiaPrefix, applyStateFilter, stateSearchTerms };
