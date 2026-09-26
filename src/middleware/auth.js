const jwt = require("jsonwebtoken");
const { User } = require("../models");
const {
  canReviewMonthlyReport,
  canSubmitForms,
} = require("../utils/monthlyReportScope");

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

/**
 * Create/update forms: allow anyone who can open the page except review-only roles.
 * Page visibility is controlled by privileges (user.functionalities).
 * Role flags can_create / can_review control create-only vs review-only UX.
 */
const requireCreateAccess = async (req, res, next) => {
  try {
    const allowed = await canSubmitForms(req.user?.role);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Your role is review-only and cannot create or edit reports",
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Allow any role with can_review_monthly (Admin → Roles).
 */
const requireReviewAccess = async (req, res, next) => {
  try {
    if (req.user?.role === "admin") return next();
    const allowed = await canReviewMonthlyReport(req.user?.role);
    if (!allowed) {
      return res.status(403).json({ success: false, message: "Your role cannot review reports" });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeRoleFlag,
  requireCreateAccess,
  requireReviewAccess,
  JWT_SECRET,
};
