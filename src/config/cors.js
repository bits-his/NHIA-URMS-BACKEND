/**
 * CORS — only listed frontend origins may call the API from a browser.
 * Set CLIENT_URL and/or ALLOWED_ORIGINS (comma-separated) on the server.
 *
 * Note: CORS does not block curl/Postman/server scripts — use JWT auth for that.
 */
const isProduction = process.env.NODE_ENV === "production";

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function parseOrigins() {
  const raw = [process.env.CLIENT_URL, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .join(",");
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

function getAllowedOrigins() {
  const fromEnv = parseOrigins();
  if (isProduction) return fromEnv;
  return [...new Set([...fromEnv, ...DEV_ORIGINS])];
}

function corsOptions() {
  const allowed = getAllowedOrigins();

  if (isProduction && allowed.length === 0) {
    console.warn(
      "⚠️  CORS: No CLIENT_URL or ALLOWED_ORIGINS set in production — browser requests will be blocked."
    );
  } else if (!isProduction) {
    console.log(`CORS allowed origins: ${allowed.join(", ")}`);
  }

  return {
    origin(origin, callback) {
      // Non-browser clients (curl, server jobs) omit Origin — not a CORS concern.
      if (!origin) return callback(null, true);

      if (allowed.includes(origin)) return callback(null, true);

      const msg = `CORS blocked origin: ${origin}`;
      if (!isProduction) console.warn(msg);
      callback(new Error(msg));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

module.exports = { corsOptions, getAllowedOrigins, isProduction };
