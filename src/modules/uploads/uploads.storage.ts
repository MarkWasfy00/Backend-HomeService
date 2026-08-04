import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";
import multer from "multer";
import { env } from "../../core/env.js";
import { ApiError } from "../../core/errors.js";
import { messages } from "../../core/messages.js";

/**
 * Everything about *storing* an uploaded file: where it goes, what is allowed
 * in, and what it is called once it lands. Route files import from here rather
 * than configuring multer themselves, so the limits below are the limits
 * everywhere - there is no second, laxer upload path.
 *
 * The middleware is used by POST /api/v1/me/signup, where a technician's
 * documents arrive in the same request as their profile.
 */

/** Absolute, so the app behaves the same whatever directory it was started from. */
export const uploadDir = path.resolve(env.UPLOAD_DIR);

/** The URL prefix app.ts serves `uploadDir` under, and the one mappers return. */
export const uploadUrlPath = "/uploads";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Created at import time rather than on the first upload: a missing directory
// should stop the process at boot, not fail one user's signup at 3am.
mkdirSync(uploadDir, { recursive: true });

/**
 * The only three types accepted, and the extension each one is saved with.
 *
 * The extension comes from this table and never from the client's filename -
 * that string is attacker-controlled and can carry `../`, a second extension,
 * or a name that overwrites somebody else's file.
 */
const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
} as const;

type AllowedMimeType = keyof typeof extensionByMimeType;

function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return mimeType in extensionByMimeType;
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(_req, file, callback) {
    const extension = isAllowedMimeType(file.mimetype)
      ? extensionByMimeType[file.mimetype]
      : "";

    // The uuid is what makes the URL unguessable, which matters: the files are
    // served back as static content, so the name is the only thing standing
    // between a criminal record and anyone who asks for it.
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

/**
 * The configured multer instance. Call `.fields([...])` on it to declare which
 * field names a route accepts; anything else in the request is rejected as
 * LIMIT_UNEXPECTED_FILE, which core/error-handler.ts turns into a 400.
 *
 * Multer deletes whatever it already wrote when it aborts, so a rejected upload
 * never leaves a file behind. A request that fails *after* multer is done is a
 * different matter - that is what `discardUploads` below is for.
 */
export const upload = multer({
  storage,
  // Two, because that is the most any route accepts: the criminal record and
  // the profile photo. The national id is text and never arrives as a file.
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 2 },
  fileFilter(_req, file, callback) {
    if (!isAllowedMimeType(file.mimetype)) {
      callback(
        new ApiError(
          400,
          "unsupported_file_type",
          messages.uploads.unsupportedType(file.fieldname, file.mimetype),
        ),
      );
      return;
    }

    callback(null, true);
  },
});

/** The public URL of a stored file - what gets written to the database. */
export function publicUrlFor(file: Express.Multer.File) {
  return `${uploadUrlPath}/${file.filename}`;
}

/**
 * The files multer stored, keyed by field name.
 *
 * `req.files` is typed as "either an array or a map, or nothing" because multer
 * has several middlewares; `.fields()` always produces the map, and every field
 * this app declares has `maxCount: 1`, so each one collapses to a single file.
 */
export function uploadedFilesByField(
  req: Request,
): Record<string, Express.Multer.File> {
  const files = req.files;

  // No files at all - the request was JSON, or multipart with only text fields.
  if (!files || Array.isArray(files)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(files).flatMap(([field, list]) =>
      list[0] ? [[field, list[0]] as const] : [],
    ),
  );
}

/**
 * Deletes files that were stored for a request that then failed.
 *
 * Best effort on purpose: the caller is already on its way to an error
 * response, and a file we could not remove is a wasted few kilobytes, not a
 * reason to turn a 400 into a 500.
 */
export async function discardUploads(files: Express.Multer.File[]) {
  await Promise.all(
    files.map(async (file) => {
      try {
        await rm(file.path, { force: true });
      } catch (error) {
        console.error(`Could not remove orphaned upload ${file.path}`, error);
      }
    }),
  );
}
