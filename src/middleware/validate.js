const { validationResult } = require("express-validator");

/**
 * Runs after express-validator chains.
 * Returns 422 with all field errors if any exist.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

module.exports = { validate };
