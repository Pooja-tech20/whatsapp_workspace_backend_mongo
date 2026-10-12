import multer from "multer";

const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const isCsv =
      file.originalname.toLowerCase().endsWith(".csv") ||
      ["text/csv", "application/vnd.ms-excel", "text/plain"].includes(
        file.mimetype
      );

    if (!isCsv) {
      const error = new Error("Only .csv files are allowed");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  }
});

// Usage: router.post("/import", csvUpload, handler)  (form-data field name: "file")
export function csvUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      error.statusCode = 400;
      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = "CSV file is too large (max 5 MB)";
      }
    }

    next(error);
  });
}