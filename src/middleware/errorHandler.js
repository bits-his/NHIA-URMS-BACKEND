/**
 * Global error handler — must be registered last in Express.
 */
const errorHandler = (err, req, res, next) => {
  console.error(err);
  const isCors = err.message?.startsWith("CORS blocked");
  let status = isCors ? 403 : (err.status || 500);
  let message = isCors ? "Origin not allowed" : (err.message || "Internal server error");

  if (!err.status && err.name === "SequelizeUniqueConstraintError") {
    status = 409;
    message = err.parent?.sqlMessage || err.errors?.[0]?.message || "A matching record already exists";
  } else if (!err.status && err.name === "SequelizeValidationError") {
    status = 422;
    message = err.errors?.map((item) => item.message).filter(Boolean).join("; ") || message;
  }

  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = { errorHandler };
