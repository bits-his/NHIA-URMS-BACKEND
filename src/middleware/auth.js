const jwt = require("jsonwebtoken");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "nhia_secret_change_in_prod";

/** Verify JWT and attach user to req */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  try {
    const payload = jwt.verify(header.split(" ")[1], JWT_SECRET);
    const user = await User.findByPk(payload.id, { attributes: { exclude: ["password"] } });
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: "User not found or inactive" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/** Restrict to specific roles */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
};

/** Allow admin, listed extras, or any active role with the given flag. */
const authorizeRoleFlag = (flag, extraKeys = []) => async (req, res, next) => {
  try {
    const key = req.user?.role;
    if (!key) return res.status(403).json({ success: false, message: "Access denied" });
    if (key === "admin" || extraKeys.includes(key)) return next();
    const { findActiveRole } = require("../utils/roleService");
    const role = await findActiveRole(key);
    if (role?.[flag]) return next();
    return res.status(403).json({ success: false, message: "Access denied" });
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, authorize, authorizeRoleFlag, JWT_SECRET };
