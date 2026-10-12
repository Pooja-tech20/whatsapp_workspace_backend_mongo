import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

export const TEMPLATE_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "templates");
export const TEMPLATE_URL_PREFIX = "/uploads/templates";

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "video/mp4": ".mp4",
  "video/3gpp": ".3gp"
};

const MAX_FILE_SIZE = 16 * 1024 * 1024; // Meta's video limit; images are checked at 5 MB later

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(TEMPLATE_UPLOAD_DIR, { recursive: true });
    cb(null, TEMPLATE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const extension = EXTENSIONS[file.mimetype] || "";
    cb(null, `${crypto.randomBytes(16).toString("hex")}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      const error = new Error("Header media must be a JPG/PNG image or an MP4/3GP video");
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});

// form-data field name: "headerMedia". JSON requests (no file) pass straight through.
export function templateUpload(req, res, next) {
  upload.single("headerMedia")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      error.statusCode = 400;
      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = "Header media is too large (max 16 MB)";
      }
    }
    next(error);
  });
}

export async function discardUpload(file) {
  if (!file?.path) return;
  await fs.promises.unlink(file.path).catch(() => {});
}