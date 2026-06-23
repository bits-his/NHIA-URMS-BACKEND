const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { requireSettingsAccess } = require("../middleware/settingsAccess");
const {
  listUsers, getUser, createUser, updateUser, deactivateUser, activateUser, updatePrivileges,
  listZones, createZone, updateZone, deleteZone,
  listStates, createState, updateState, deleteState,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listUnits, createUnit, updateUnit, deleteUnit,
  listRoles, createRole, updateRole, deleteRole,
} = require("../controllers/admin.controller");

const router = Router();

// All routes require a valid token
router.use(authenticate);

// ─── Read-only lookups — any authenticated role ───────────────────────────────
// Departments & Units are needed by department-officer, sdo, hq-department, etc.
router.get("/departments", listDepartments);
router.get("/units",       listUnits);

// Zones & States are needed by zonal/state coordinators and state officers
router.get("/zones",  listZones);
router.get("/states", listStates);

// Roles — read for any authenticated user (dropdowns); write requires Settings access
router.get("/roles", listRoles);

// Staff count — scoped to the caller's own state/zone (non-admin safe)
// Returns only count + minimal fields; no passwords, no sensitive data
router.get("/staff-count", async (req, res, next) => {
  try {
    const { User } = require("../models");
    const { Op }   = require("sequelize");
    const where    = {};

    // Non-admins can only query their own state or zone
    if (req.user.role !== "admin") {
      if (req.query.state_id) {
        // Must match the caller's own state
        if (String(req.user.state_id) !== String(req.query.state_id)) {
          return res.status(403).json({ success: false, message: "Access denied: not your state" });
        }
        where.state_id = req.query.state_id;
      } else if (req.query.zone_id) {
        if (String(req.user.zone_id) !== String(req.query.zone_id)) {
          return res.status(403).json({ success: false, message: "Access denied: not your zone" });
        }
        where.zone_id = req.query.zone_id;
      } else {
        // Default: scope to caller's own state
        if (req.user.state_id) where.state_id = req.user.state_id;
      }
    } else {
      // Admin: honour any filter
      if (req.query.state_id)  where.state_id  = req.query.state_id;
      if (req.query.zone_id)   where.zone_id   = req.query.zone_id;
    }

    if (req.query.role) where.role = req.query.role;
    where.is_active = true;

    const total = await User.count({ where });
    res.json({ success: true, total });
  } catch (err) { next(err); }
});

// ─── Settings module (admin or privileged users) ─────────────────────────────
router.use(requireSettingsAccess);

// Users
router.get("/users",                listUsers);
router.get("/users/:id",            getUser);
router.post("/users",               createUser);
router.put("/users/:id",            updateUser);
router.patch("/users/:id/privileges", updatePrivileges);
router.patch("/users/:id/deactivate", deactivateUser);
router.patch("/users/:id/activate",   activateUser);

// Zonal Offices (write)
router.post("/zones",        createZone);
router.put("/zones/:id",     updateZone);
router.delete("/zones/:id",  deleteZone);

// State Offices (write)
router.post("/states",        createState);
router.put("/states/:id",     updateState);
router.delete("/states/:id",  deleteState);

// Departments (write)
router.post("/departments",        createDepartment);
router.put("/departments/:id",     updateDepartment);
router.delete("/departments/:id",  deleteDepartment);

// Units (write)
router.post("/units",        createUnit);
router.put("/units/:id",     updateUnit);
router.delete("/units/:id",  deleteUnit);

// Roles (write)
router.post("/roles",        createRole);
router.put("/roles/:id",     updateRole);
router.delete("/roles/:id",  deleteRole);

module.exports = router;
