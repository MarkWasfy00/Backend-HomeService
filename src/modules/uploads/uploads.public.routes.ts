import { Router } from "express";
import { ApiError } from "../../core/errors.js";

/**
 * TASK 4 - the standalone upload endpoint, for a client that uploads a document
 * and *then* submits the form, rather than sending both at once.
 *
 * Mounted at /api/v1/public/uploads.
 *
 * **The storage layer already exists** - POST /api/v1/me/signup needed it, so
 * multer is installed and modules/uploads/uploads.storage.ts holds all of it:
 * the configured instance, the JPEG/PNG/PDF filter, the 5 MB limit, the
 * rename-on-disk, `publicUrlFor` and `discardUploads`. app.ts already serves
 * the folder under `uploadUrlPath`, and core/error-handler.ts already turns a
 * MulterError into a 400.
 *
 * So import `upload` and `publicUrlFor` from ./uploads.storage.js. Do **not**
 * configure a second multer here: two instances means two sets of limits, and
 * the laxer one becomes the way in.
 */
export const uploadsPublicRoutes = Router();

/** POST /api/v1/public/uploads - multipart/form-data, field name "file" */
uploadsPublicRoutes.post("/", async (_req, res) => {
  // TODO(task 4): add `upload.single("file")` as route middleware, then
  //   res.status(201).json({ data: { url: publicUrlFor(req.file) } });
  //
  // `upload.single` leaves `req.file` undefined when the request carried no
  // file at all - the filter never runs, so nothing rejects it. That case has
  // to become a 400 here, or the line above reads `.filename` of undefined and
  // a missing field turns into a 500.
  throw ApiError.notImplemented();
});
