const path = require("path");
const fs = require("fs");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/utility-services");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed. Please upload PDF, Word, Excel, or an image."));
  },
});

const utilityFilesUpload = upload.fields([
  { name: "job_completion_cert", maxCount: 1 },
  { name: "invoice", maxCount: 1 },
  { name: "contractor_letter", maxCount: 1 },
  { name: "additional_files", maxCount: 5 },
]);

function removeUtilityFile(filePath) {
  if (!filePath) return;
  const name = path.basename(String(filePath));
  const abs = path.join(UPLOAD_DIR, name);
  if (fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  upload,
  UPLOAD_DIR,
  utilityFilesUpload,
  removeUtilityFile,
};

