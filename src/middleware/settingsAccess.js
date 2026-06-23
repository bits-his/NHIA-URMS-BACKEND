/** Admin or any user granted the Settings module via privileges */
function requireSettingsAccess(req, res, next) {
  if (req.user?.role === "admin") return next();

  let access = req.user?.functionalities;
  if (typeof access === "string") {
    try { access = JSON.parse(access); } catch { access = []; }
  }
  if (!Array.isArray(access)) access = [];

  if (access.some((e) => e.access_to === "Settings")) return next();

  return res.status(403).json({ success: false, message: "Access denied" });
}

module.exports = { requireSettingsAccess };
