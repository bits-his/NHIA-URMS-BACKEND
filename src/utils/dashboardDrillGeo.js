const { StateOffice, ZonalOffice } = require("../models");

/** Build zone summary rows for drill-down */
async function buildZoneBreakdown(countForZone) {
  const zones = await ZonalOffice.findAll({
    attributes: ["id", "description"],
    order: [["description", "ASC"]],
  });
  const rows = [];
  for (const zone of zones) {
    const count = await countForZone(zone.id);
    if (count > 0) {
      rows.push({
        id: zone.id,
        reference: null,
        title: zone.description,
        subtitle: "Zonal office",
        status: String(count),
        date: null,
        zone_name: zone.description,
        zone_id: zone.id,
        state_name: null,
        meta: `zone:${zone.id}`,
      });
    }
  }
  return rows;
}

/** Build state summary rows within a zone for drill-down */
async function buildStateBreakdownInZone(zoneId, countForState) {
  const zone = await ZonalOffice.findByPk(zoneId, { attributes: ["id", "description"] });
  const states = await StateOffice.findAll({
    where: { zonal_id: zoneId },
    attributes: ["id", "description"],
    order: [["description", "ASC"]],
  });
  const rows = [];
  for (const st of states) {
    const count = await countForState(st.id);
    if (count > 0) {
      rows.push({
        id: st.id,
        reference: null,
        title: st.description,
        subtitle: zone?.description ? `In ${zone.description}` : "State office",
        status: String(count),
        date: null,
        zone_name: zone?.description ?? null,
        zone_id: zone?.id ?? zoneId,
        state_name: st.description,
        state_id: st.id,
        meta: `state:${st.id}`,
      });
    }
  }
  return rows;
}

module.exports = { buildZoneBreakdown, buildStateBreakdownInZone };
