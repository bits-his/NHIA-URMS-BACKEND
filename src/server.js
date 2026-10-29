/**
 * NHIA URMS Backend — form-by-form rebuild mode.
 * Loads ONLY active (core) models. Legacy report routes are NOT mounted.
 */
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { corsOptions, isProduction } = require("./config/cors");
const sequelize = require("./config/database");
const { APPROVED_FORMS, CORE_TABLES } = require("./config/activeSchema");

// Core + approved forms only — does NOT register legacy report models
require("./models/active");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const accreditedProvidersRoutes = require("./routes/accreditedProviders.routes");
const hcfFacilitiesRoutes = require("./routes/hcfFacilities.routes");
const hmoProvidersRoutes = require("./routes/hmoProviders.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const platformRoutes = require("./routes/redesign/platform.routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors(corsOptions()));
app.set("etag", false);
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(morgan("dev"));

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    mode: "form-by-form-rebuild",
    version: require("../package.json").version,
    core_tables: CORE_TABLES.length,
    approved_forms: Object.keys(APPROVED_FORMS),
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      lookups: "/api/platform/lookups/:domainKey",
      providers: "/api/accredited-providers | /api/hcf-facilities | /api/hmo-providers",
    },
  }),
);

// ── Core routes only ─────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/accredited-providers", accreditedProvidersRoutes);
app.use("/api/hcf-facilities", hcfFacilitiesRoutes);
app.use("/api/hmo-providers", hmoProvidersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/platform", platformRoutes);

// Explicit 503 for legacy domains until their form design is approved
const notRebuilt = (name) => (req, res) => {
  res.status(503).json({
    success: false,
    message: `${name} is disabled during database rebuild. Approve the form design first, then it will be re-enabled.`,
  });
};

app.use("/api/annual-reports", notRebuilt("Annual reports"));
app.use("/api/stock", notRebuilt("Stock"));
app.use("/api/monthly", notRebuilt("Monthly HQ reports"));
// Approved SERVICOM packs; other SERVICOM routes stay 503
if (APPROVED_FORMS["comment-card"]) {
  app.use("/api/servicom/comment-cards", require("./routes/commentCard.routes"));
}
if (APPROVED_FORMS["satisfaction-survey"]) {
  app.use("/api/servicom/satisfaction-surveys", require("./routes/satisfactionSurvey.routes"));
}
if (APPROVED_FORMS.complaints) {
  const complaintsRoutes = require("./routes/complaints.routes");
  const complaintsCtrl = require("./controllers/complaints.controller");
  const { authenticate } = require("./middleware/auth");
  app.use("/api/servicom/complaints", complaintsRoutes);
  // Legacy FE paths used by the complaints pack
  app.get("/api/servicom/complaint-sla", authenticate, complaintsCtrl.listComplaintSla);
  app.get("/api/servicom/investigating-officers", authenticate, complaintsCtrl.listInvestigatingOfficers);
}
// Dashboards for approved SERVICOM packs (comment-card / satisfaction / complaints)
if (
  APPROVED_FORMS["comment-card"]
  || APPROVED_FORMS["satisfaction-survey"]
  || APPROVED_FORMS.complaints
) {
  const { authenticate } = require("./middleware/auth");
  const servicomDash = require("./controllers/servicomDashboard.controller");
  app.get("/api/servicom/dashboard", authenticate, servicomDash.dashboard);
  app.get("/api/servicom/dashboard/drill", authenticate, servicomDash.dashboardDrill);
  app.get("/api/servicom/complaints-dashboard", authenticate, servicomDash.complaintsDashboard);
}
app.use("/api/servicom", notRebuilt("SERVICOM"));
// Approved state-office packs first; remaining state-office paths stay 503
if (APPROVED_FORMS.enrolment) {
  app.use("/api/state-office/enrolment", require("./routes/enrolmentPack.routes"));
}
if (APPROVED_FORMS["enrolment-drives"]) {
  require("./routes/enrolmentDrivePack.routes").mountEnrolmentDrivePack(app);
}
if (APPROVED_FORMS["beneficiary-management"]) {
  require("./routes/beneficiaryPack.routes").mountBeneficiaryPack(app);
}
if (APPROVED_FORMS["stakeholder-management"]) {
  app.use("/api/state-office/stakeholder", require("./routes/stakeholderPack.routes"));
}
if (APPROVED_FORMS["provider-management"]) {
  require("./routes/providerPack.routes").mountProviderPack(app);
}
if (APPROVED_FORMS["weekly-compliance"]) {
  app.use("/api/state-office/weekly-compliance", require("./routes/weeklyCompliancePack.routes"));
}
if (APPROVED_FORMS["hmo-indebtedness"]) {
  require("./routes/hmoIndebtednessPack.routes").mountHmoIndebtednessPack(app);
}
// Operational home for state coordinators — approved packs only (must precede catch-all)
{
  const { authenticate } = require("./middleware/auth");
  const opsDash = require("./controllers/stateOfficeOperationalDashboard.controller");
  app.get("/api/state-office/dashboard", authenticate, opsDash.dashboard);
  app.get("/api/state-office/dashboard/drill", authenticate, opsDash.dashboardDrill);
}
app.use("/api/state-office", notRebuilt("State office forms"));
app.use("/api/sqa", notRebuilt("SQA compliance"));
if (APPROVED_FORMS["store-management"]) {
  app.use("/api/store-management", require("./routes/storePack.routes"));
} else {
  app.use("/api/store-management", notRebuilt("Store management"));
}

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  MySQL connected");
    console.log(`ℹ️   Rebuild mode — core tables only. Approved forms: ${Object.keys(APPROVED_FORMS).join(", ") || "(none yet)"}`);

    // Light org column patches (safe if tables exist)
    const qi = sequelize.getQueryInterface();
    try {
      const stateCols = await qi.describeTable("state_offices");
      const flagCol = { type: "TINYINT(1)", allowNull: false, defaultValue: 0 };
      if (!stateCols.is_hq) await qi.addColumn("state_offices", "is_hq", flagCol);
      if (!stateCols.is_zonal_office) await qi.addColumn("state_offices", "is_zonal_office", flagCol);
    } catch (_) { /* */ }

    try {
      const { seedDepartmentsUnits } = require("./scripts/seedDepartmentsUnits");
      const { syncDeptDivUnits } = require("./scripts/syncDeptDivUnits");
      // These scripts require models — point them at active via models/index
      await seedDepartmentsUnits({ quiet: true });
      await syncDeptDivUnits({ prune: false });
    } catch (catalogErr) {
      console.warn("⚠️  Department/unit catalog sync skipped:", catalogErr.message);
    }

    app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT} (rebuild mode)`));
  } catch (err) {
    console.error("❌  Cannot connect to DB:", err.message);
    process.exit(1);
  }
})();
