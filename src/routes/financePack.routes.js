/**
 * Finance packs + dashboards.
 *   /api/state-office/igr
 *   /api/state-office/sshia-financial
 *   /api/state-office/expenditure-profile
 *   /api/state-office/finance/dashboard/*
 */
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { igr, sshia, expenditure } = require("../controllers/financePack.controller");
const dash = require("../controllers/financeDashboard.controller");

function buildRouter(ctrl) {
  const router = express.Router();
  router.use(authenticate);
  router.get("/reports", ctrl.listReports);
  router.get("/reports/:id", ctrl.getReport);
  router.post("/reports", ctrl.createReport);
  router.put("/reports/:id", ctrl.updateReport);
  router.patch("/reports/:id/status", ctrl.updateStatus);
  return router;
}

function mountFinancePack(app) {
  app.use("/api/state-office/igr", buildRouter(igr));
  app.use("/api/state-office/sshia-financial", buildRouter(sshia));
  app.use("/api/state-office/expenditure-profile", buildRouter(expenditure));

  const dashRouter = express.Router();
  dashRouter.use(authenticate);
  dashRouter.get("/", dash.overview);
  dashRouter.get("/igr", dash.igrDashboard);
  dashRouter.get("/sshia", dash.sshiaDashboard);
  app.use("/api/state-office/finance/dashboard", dashRouter);
}

module.exports = { mountFinancePack };
