const express = require("express");
const { authenticate } = require("../middleware/auth");
const indebtedness = require("../controllers/hmoIndebtednessPack.controller");
const recon = require("../controllers/hmoReconPack.controller");
const master = require("../controllers/hmoMasterPack.controller");

function mountHmoIndebtednessPack(app) {
  const coll = express.Router();
  coll.use(authenticate);
  coll.get("/", indebtedness.listSheets);
  coll.get("/:id", indebtedness.getSheet);
  coll.post("/", indebtedness.createSheet);
  coll.put("/:id", indebtedness.updateSheet);
  app.use("/api/state-office/hmo-indebtedness", coll);

  const rec = express.Router();
  rec.use(authenticate);
  rec.get("/", recon.listSheets);
  rec.get("/:id", recon.getSheet);
  rec.post("/", recon.createSheet);
  rec.put("/:id", recon.updateSheet);
  app.use("/api/state-office/hmo-reconciliation", rec);

  const mst = express.Router();
  mst.use(authenticate);
  mst.get("/compiled", master.compileMaster);
  mst.get("/facts", master.listFacts);
  // Master is view-only — no POST/PUT persisted sheets
  app.use("/api/state-office/hmo-master", mst);
}

module.exports = { mountHmoIndebtednessPack };
