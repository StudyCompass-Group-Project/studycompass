import multer from "multer";
import { HttpError } from "../utils/validate.js";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB; Gemini accepts up to 20 MB inline per request

// memoryStorage keeps the uploaded file in RAM as a Buffer (req.file.buffer). We
// send it straight to Gemini and never write it to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new HttpError(400, "Only PDF files are supported. You can also paste the syllabus text."));
  },
});

// Wraps multer so its errors become clean JSON errors instead of crashing into the
// generic 500 handler. It only reads multipart/form-data; plain JSON requests pass through.
export function uploadSyllabus(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new HttpError(413, `File is too large. The limit is ${MAX_BYTES / 1024 / 1024} MB.`));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new HttpError(400, 'Send the PDF in a form field named "file".'));
      }
      return next(new HttpError(400, err.message));
    }
    next(err);
  });
}