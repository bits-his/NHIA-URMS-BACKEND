/**
 * ─── NHIA URMS Backend Server Entry Point ─────────────────────────────────────
 * Express server initialization file. Configures security headers, global
 * middleware, database connections, Sequelize models, and RESTful API routes.
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { corsOptions, isProduction } = require("./config/cors");

// Database configuration & Sequelize ORM initialization
const sequelize = require("./config/database");

// Register all Sequelize database models & model associations
require("./models/index");

// ─── API Route Imports ────────────────────────────────────────────────────────
const annualReportRoutes = require("./routes/annualReport.routes");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const stockRoutes = require("./routes/stockVerification.routes");
const monthlyRoutes = require("./routes/monthlyReport.routes");
const servicomRoutes = require("./routes/servicom.routes");
const stateOfficeRoutes = require("./routes/stateOffice.routes");
const accreditedProvidersRoutes = require("./routes/accreditedProviders.routes");
const hcfFacilitiesRoutes = require("./routes/hcfFacilities.routes");
const hmoProvidersRoutes = require("./routes/hmoProviders.routes");
const complianceReportRoutes = require("./routes/complianceReport.routes");
const storeManagementRoutes = require("./routes/storeManagementRoutes");
const notificationsRoutes = require("./routes/notifications.routes");
const { errorHandler } = require("./middleware/errorHandler");

// Initialize Express application instance
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Global Middleware ─────────────────────────────────────────────

// Enable Cross-Origin Resource Sharing (CORS) based on environment configuration
app.use(cors(corsOptions()));

// Security Headers Middleware: Set defensive HTTP response headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// JSON body parser with 2MB payload ceiling for large report submissions
app.use(express.json({ limit: "2mb" }));

// Static asset file server for uploaded documents & attachments
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// HTTP request logger middleware
app.use(morgan("dev"));

// ─── API Route Registrations ──────────────────────────────────────────────────

/**
 * GET /health
 * System health check endpoint returning service status, backend version,
 * and key API route references.
 */
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

// Mount domain-specific API route handlers
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/annual-reports", annualReportRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/monthly", monthlyRoutes);
app.use("/api/servicom", servicomRoutes);
app.use("/api/accredited-providers", accreditedProvidersRoutes);
app.use("/api/hcf-facilities", hcfFacilitiesRoutes);
app.use("/api/hmo-providers", hmoProvidersRoutes);
app.use("/api/state-office", stateOfficeRoutes);
app.use("/api/sqa/compliance-reports", complianceReportRoutes);
app.use("/api/store-management", storeManagementRoutes);
app.use("/api/notifications", notificationsRoutes);

// ─── 404 Fallback Handler ─────────────────────────────────────────────────────

// Catch-all handler for undefined API routes
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// ─── Centralized Error Handler ────────────────────────────────────────────────

// Global error handling middleware for handling thrown exceptions & async errors
app.use(errorHandler);

// ─── Database Connection & Server Bootstrapping ───────────────────────────────

(async () => {
  try {
    // Authenticate database connection via Sequelize ORM
    await sequelize.authenticate();
    console.log("✅  MySQL connected");
    
    // Start listening for HTTP connections
    app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌  Cannot connect to DB:", err.message);
    process.exit(1);
  }
})();

