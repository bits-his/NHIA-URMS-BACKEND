require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { corsOptions, isProduction } = require("./config/cors");

const sequelize = require("./config/database");
// Register all models & associations
require("./models/index");

const annualReportRoutes = require("./routes/annualReport.routes");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const stockRoutes = require("./routes/stockVerification.routes");
const monthlyRoutes = require("./routes/monthlyReport.routes");
const servicomRoutes = require("./routes/servicom.routes");
const stateOfficeRoutes = require("./routes/stateOffice.routes");
const accreditedProvidersRoutes = require("./routes/accreditedProviders.routes");
const complianceReportRoutes = require("./routes/complianceReport.routes");
const storeManagementRoutes = require("./routes/storeManagementRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors(corsOptions()));

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

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    version: require("../package.json").version,
    endpoints: {
      stockDashboard: "/api/stock/dashboard",
      socDashboard: "/api/state-office/dashboard",
      stateOfficeReports: "/api/state-office/{section}/reports",
      servicomDashboard: "/api/servicom/dashboard",
    },
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/annual-reports", annualReportRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/monthly", monthlyRoutes);
app.use("/api/servicom", servicomRoutes);
app.use("/api/accredited-providers", accreditedProvidersRoutes);
app.use("/api/state-office", stateOfficeRoutes);
app.use("/api/sqa/compliance-reports", complianceReportRoutes);
app.use("/api/store-management", storeManagementRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  MySQL connected");
    app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌  Cannot connect to DB:", err.message);
    process.exit(1);
  }
})();
