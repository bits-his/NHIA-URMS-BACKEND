const path = require("path");
const fs = require("fs");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/office-profiles");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("AOP file type not allowed. Use PDF, Word, Excel, or an image."));
  },
});

function optionalAopUpload(req, res, next) {
  upload.single("aop")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}

function removeAopFile(filePath) {
  if (!filePath) return;
  const name = path.basename(String(filePath));
  const abs = path.join(UPLOAD_DIR, name);
  if (fs.existsSync(abs)) {
    try { fs.unlinkSync(abs); } catch { /* ignore */ }
  }
}

module.exports = { upload, UPLOAD_DIR, optionalAopUpload, removeAopFile };
