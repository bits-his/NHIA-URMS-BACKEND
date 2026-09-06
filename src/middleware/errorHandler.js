/**
 * Global error handler — must be registered last in Express.
 */
const errorHandler = (err, req, res, next) => {
  console.error(err);
  const isCors = err.message?.startsWith("CORS blocked");
  const status = isCors ? 403 : (err.status || 500);
  res.status(status).json({
    success: false,
    message: isCors ? "Origin not allowed" : (err.message || "Internal server error"),
  });
};

module.exports = { errorHandler };
