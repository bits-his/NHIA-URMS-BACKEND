require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const sequelize = require("./config/database");
// Register all models & associations
require("./models/index");

const annualReportRoutes = require("./routes/annualReport.routes");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const stockRoutes = require("./routes/stockVerification.routes");
const monthlyRoutes = require("./routes/monthlyReport.routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5173",
    ];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(morgan("dev"));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/annual-reports", annualReportRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/monthly", monthlyRoutes);

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
