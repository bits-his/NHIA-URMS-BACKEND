const path = require("path");
const fs = require("fs");
const { randomBytes } = require("crypto");
const multer = require("multer");

const PRIVATE_DIR = path.join(__dirname, "../../storage/enrolment-drives");
const types = {
  "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"],
  "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "audio/mpeg": [".mp3"], "audio/wav": [".wav"], "video/mp4": [".mp4"],
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 }, (error) => cb(error, PRIVATE_DIR)),
    filename: (_req, file, cb) => cb(null, `${randomBytes(24).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (types[file.mimetype]?.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(Object.assign(new Error("Unsupported evidence file type"), { status: 422 }));
  },
});
module.exports = { PRIVATE_DIR, upload };
