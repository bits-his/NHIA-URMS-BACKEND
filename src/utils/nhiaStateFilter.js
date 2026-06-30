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
