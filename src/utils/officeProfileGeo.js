const { StateOffice, ZonalOffice } = require("../models/active");

/**
 * Resolves geo codes and models for Office Profile operations.
 * Accepts code ("KAN", "NW") or integer/string ID from legacy parameters.
 */
async function resolveOfficeGeo(user, input = {}) {
  const rawState = input.state_code || input.state_id || user?.state_code || user?.state_id;
  const rawZone = input.zonal_code || input.zone_id || user?.zonal_code || user?.zone_id;

  let state = null;
  let zone = null;

  if (rawState) {
    const sStr = String(rawState).trim();
    state = await StateOffice.findOne({
      where: { code: sStr },
    });
    if (!state && /^\d+$/.test(sStr)) {
      // If a numeric ID was provided, fetch all and match by position/fallback
      const allStates = await StateOffice.findAll({ order: [["code", "ASC"]] });
      const idx = parseInt(sStr, 10);
      state = allStates[idx - 1] || allStates.find((s) => s.code === sStr);
    }
  }

  if (state?.zonal_code) {
    zone = await ZonalOffice.findOne({ where: { zonal_code: state.zonal_code } });
  } else if (rawZone) {
    const zStr = String(rawZone).trim();
    zone = await ZonalOffice.findOne({ where: { zonal_code: zStr } });
    if (!zone && /^\d+$/.test(zStr)) {
      const allZones = await ZonalOffice.findAll({ order: [["zonal_code", "ASC"]] });
      const idx = parseInt(zStr, 10);
      zone = allZones[idx - 1] || allZones.find((z) => z.zonal_code === zStr);
    }
  }

  return {
    state,
    zone,
    state_code: state?.code || null,
    zonal_code: zone?.zonal_code || state?.zonal_code || null,
    state_id: input.state_id ? Number(input.state_id) : null,
    zone_id: input.zone_id ? Number(input.zone_id) : null,
  };
}

module.exports = { resolveOfficeGeo };

