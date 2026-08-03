import { Router } from "express";
import { ApiError } from "../../core/errors.js";

/**
 * TASK 4 - file upload. Needed by task 3: the technician's national id and
 * criminal record are uploaded here first, and the returned URLs are what get
 * sent to POST /technician/profile.
 *
 * Mounted at /api/v1/public/uploads.
 *
 * Setup (not installed yet):
 *   npm install multer && npm install -D @types/multer
 *
 * Then configure it in this file:
 *   - disk storage into an `uploads/` folder (already in .gitignore)
 *   - rename every file yourself: `${Date.now()}-${randomUUID()}${extension}`.
 *     Never reuse the name the client sent - it can contain `../` or overwrite
 *     someone else's file.
 *   - fileFilter: image/jpeg, image/png, application/pdf only
 *   - limits: { fileSize: 5 * 1024 * 1024 }
 *
 * And serve the folder in src/app.ts so the saved files can be read back:
 *   app.use("/uploads", express.static("uploads"));
 *
 * Multer rejections (wrong type, too big) arrive as a MulterError - add a
 * branch for it in core/error-handler.ts so they become 400s instead of 500s.
 */
export const uploadsPublicRoutes = Router();

/** POST /api/v1/public/uploads - multipart/form-data, field name "file" */
uploadsPublicRoutes.post("/", async (_req, res) => {
  // TODO(task 4): run the multer middleware, then reply with the public URL:
  //   res.status(201).json({ data: { url: `/uploads/${req.file.filename}` } });
  throw ApiError.notImplemented();
});
