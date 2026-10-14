
import multer from "multer";
import fs from "node:fs";
import path from "node:path";

export const MEDIA_UPLOAD_DIR = path.resolve(
  process.cwd(),
  "uploads",
  "media"
);

fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "text/csv"
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, MEDIA_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension)
        ? extension
        : "";

      cb(null, `${crypto.randomUUID()}${safeExtension}`);
    }
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Unsupported media file type");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  }
});

import crypto from "node:crypto";

export function mediaUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      error.statusCode = 400;

      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = "File is too large. Maximum size is 25 MB.";
      }
    }

    next(error);
  });
}
