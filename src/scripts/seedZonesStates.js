require("dotenv").config();
const sequelize  = require("../config/database");
require("../models/index");
const ZonalOffice = require("../models/ZonalOffice");
const StateOffice = require("../models/StateOffice");

const ZONES = [
  { zonal_code: "NW",  description: "North West"   },
  { zonal_code: "NE",  description: "North East"   },
  { zonal_code: "NC",  description: "North Central" },
  { zonal_code: "SW",  description: "South West"   },
  { zonal_code: "SE",  description: "South East"   },
  { zonal_code: "SS",  description: "South South"  },
];

const STATES = [
  // North West
  { code: "JIG", description: "Jigawa",   zone: "NW" },
  { code: "KAD", description: "Kaduna",   zone: "NW" },
  { code: "KAN", description: "Kano",     zone: "NW" },
  { code: "KAT", description: "Katsina",  zone: "NW" },
  { code: "KEB", description: "Kebbi",    zone: "NW" },
  { code: "SOK", description: "Sokoto",   zone: "NW" },
  { code: "ZAM", description: "Zamfara",  zone: "NW" },
  // North East
  { code: "ADA", description: "Adamawa",  zone: "NE" },
  { code: "BAU", description: "Bauchi",   zone: "NE" },
  { code: "BOR", description: "Borno",    zone: "NE" },
  { code: "GOM", description: "Gombe",    zone: "NE" },
  { code: "TAR", description: "Taraba",   zone: "NE" },
  { code: "YOB", description: "Yobe",     zone: "NE" },
  // North Central
  { code: "BEN", description: "Benue",    zone: "NC" },
  { code: "KOG", description: "Kogi",     zone: "NC" },
  { code: "KWA", description: "Kwara",    zone: "NC" },
  { code: "NAS", description: "Nasarawa", zone: "NC" },
  { code: "NIG", description: "Niger",    zone: "NC" },
  { code: "PLA", description: "Plateau",  zone: "NC" },
  { code: "FCT", description: "FCT (Abuja)", zone: "NC" },
  // South West
  { code: "EKI", description: "Ekiti",    zone: "SW" },
  { code: "LAG", description: "Lagos",    zone: "SW" },
  { code: "OGU", description: "Ogun",     zone: "SW" },
  { code: "OND", description: "Ondo",     zone: "SW" },
  { code: "OSU", description: "Osun",     zone: "SW" },
  { code: "OYO", description: "Oyo",      zone: "SW" },
  // South East
  { code: "ABI", description: "Abia",     zone: "SE" },
  { code: "ANA", description: "Anambra",  zone: "SE" },
  { code: "EBO", description: "Ebonyi",   zone: "SE" },
  { code: "ENU", description: "Enugu",    zone: "SE" },
  { code: "IMO", description: "Imo",      zone: "SE" },
  // South South
  { code: "AKW", description: "Akwa Ibom",   zone: "SS" },
  { code: "BAY", description: "Bayelsa",     zone: "SS" },
  { code: "CRO", description: "Cross River", zone: "SS" },
  { code: "DEL", description: "Delta",       zone: "SS" },
  { code: "EDO", description: "Edo",         zone: "SS" },
  { code: "RIV", description: "Rivers",      zone: "SS" },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected");

    // Sync tables (alter safe)
    await sequelize.sync({ alter: true });
    console.log("✅  Tables synced");

    // Seed zones
    for (const z of ZONES) {
      await ZonalOffice.upsert(z);
    }
    console.log(`✅  ${ZONES.length} zonal offices seeded`);

    // Build zone code → id map
    const zones = await ZonalOffice.findAll();
    const zoneMap = Object.fromEntries(zones.map(z => [z.zonal_code, z.id]));

    // Seed states
    for (const s of STATES) {
      await StateOffice.upsert({
        code:        s.code,
        description: s.description,
        zonal_id:    zoneMap[s.zone],
      });
    }
    console.log(`✅  ${STATES.length} state offices seeded`);

    console.log("\n🎉  Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
