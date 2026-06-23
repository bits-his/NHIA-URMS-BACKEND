const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Role } = require("../models");
const { JWT_SECRET } = require("../middleware/auth");

async function attachRoleMeta(userData) {
  const roleRecord = await Role.findOne({ where: { key: userData.role } });
  if (roleRecord) {
    userData.role_label = roleRecord.label;
    userData.role_config = {
      report_scope: roleRecord.report_scope,
      can_create_monthly: roleRecord.can_create_monthly,
      can_review_monthly: roleRecord.can_review_monthly,
    };
  }
  return userData;
}

/** POST /api/auth/login */
const login = async (req, res, next) => {
  try {
    const { staff_id, password } = req.body;
    if (!staff_id || !password) {
      return res.status(400).json({ success: false, message: "staff_id and password required" });
    }

    const user = await User.findOne({
      where: { staff_id },
      include: [
        { association: "zone",       attributes: ["id", "zonal_code", "description"] },
        { association: "state",      attributes: ["id", "code", "description"] },
        { association: "department", attributes: ["id", "name", "department_code"] },
        { association: "unit",       attributes: ["id", "name", "unit_code"] },
      ],
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });

    const { password: _pw, ...userData } = user.toJSON();

    // Parse functionalities JSON string → array if needed
    if (typeof userData.functionalities === "string") {
      try { userData.functionalities = JSON.parse(userData.functionalities); }
      catch { userData.functionalities = []; }
    }
    if (!Array.isArray(userData.functionalities)) userData.functionalities = [];

    await attachRoleMeta(userData);
    res.json({ success: true, token, user: userData });
  } catch (err) {
    next(err);
  }
};

/** GET /api/auth/me */
const me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
      include: [
        { association: "zone",       attributes: ["id", "zonal_code", "description"] },
        { association: "state",      attributes: ["id", "code", "description"] },
        { association: "department", attributes: ["id", "name", "department_code"] },
        { association: "unit",       attributes: ["id", "name", "unit_code"] },
      ],
    });
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    const userData = user.toJSON();
    if (typeof userData.functionalities === "string") {
      try { userData.functionalities = JSON.parse(userData.functionalities); }
      catch { userData.functionalities = []; }
    }
    if (!Array.isArray(userData.functionalities)) userData.functionalities = [];
    await attachRoleMeta(userData);
    res.json({ success: true, user: userData });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, me };
