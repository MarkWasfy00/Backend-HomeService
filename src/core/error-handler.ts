import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "./errors.js";
import { isProduction } from "./env.js";
import { messages } from "./messages.js";

/** Every error response in the app has this shape. */
type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Digs the offending column names out of a unique-constraint error so we can
 * answer "phone is already in use" instead of something vague.
 *
 * Prisma 7 reports these through the driver adapter, at
 * `meta.driverAdapterError.cause.constraint.fields`. Older versions used
 * `meta.target`, so both are checked.
 */
function uniqueConstraintFields(
  err: Prisma.PrismaClientKnownRequestError,
): string[] {
  const meta = err.meta as
    | {
        target?: string[];
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[] } };
        };
      }
    | undefined;

  return (
    meta?.driverAdapterError?.cause?.constraint?.fields ?? meta?.target ?? []
  );
}

/**
 * Which side of a foreign key broke.
 *
 * Postgres answers with one code (23503) for two opposite situations, and they
 * need opposite sentences:
 *
 *   "insert or update on table …"  this row points at a parent that is not there
 *   "update or delete on table …"  this row still has children pointing at it
 *
 * Prisma does not separate them, so the driver's own message is read here. The
 * first case is the common one on write endpoints - signing up as a technician
 * with a `categoryId` that does not exist lands right here - and telling that
 * caller their record "is still referenced by other records" sends them looking
 * for a problem that is not theirs.
 */
function foreignKeyMessage(err: Prisma.PrismaClientKnownRequestError): string {
  const meta = err.meta as
    | { driverAdapterError?: { cause?: { originalMessage?: string } } }
    | undefined;

  const original = meta?.driverAdapterError?.cause?.originalMessage ?? "";

  if (original.startsWith("insert or update")) {
    return messages.validation.referencedRecordMissing;
  }

  if (original.startsWith("update or delete")) {
    return messages.validation.stillReferenced;
  }

  // An older Prisma, or a driver that words it differently. Both halves, since
  // there is no way to tell which one it was.
  return messages.validation.foreignKeyEitherWay;
}

/**
 * Multer reports a rejected upload with a code rather than a sentence, and its
 * own messages ("File too large") say nothing about which field or what the
 * limit is - and are in English. These say both, in Arabic.
 *
 * The `default` branch hands back multer's own English sentence, which is the
 * honest answer: it only fires on a code we have not seen, and a wrong Arabic
 * guess would be worse than a right English one.
 */
function uploadErrorMessage(err: MulterError): string {
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return messages.uploads.tooLarge(err.field ?? "");
    case "LIMIT_UNEXPECTED_FILE":
      return messages.uploads.unexpectedFile(err.field ?? "");
    case "LIMIT_FILE_COUNT":
      return messages.uploads.tooManyFiles;
    case "LIMIT_PART_COUNT":
      return messages.uploads.tooManyParts;
    default:
      return err.message;
  }
}

/** Runs when no route matched the URL. */
export function notFoundHandler(req: Request, res: Response<ErrorBody>) {
  res.status(404).json({
    error: {
      code: "not_found",
      message: messages.generic.routeNotFound(req.method, req.originalUrl),
    },
  });
}

/**
 * The single place where errors become HTTP responses.
 *
 * Express 5 forwards rejected promises here automatically, so route handlers
 * never need their own try/catch - just `throw` and let this translate it.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ErrorBody>,
  // Express only treats a middleware as an error handler if it declares four
  // parameters, so `next` must stay even though it is unused.
  _next: NextFunction,
) {
  // 1. Errors we threw on purpose.
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // 2. Validation failures from `schema.parse(...)` in a route.
  //
  //    `field` stays the English JSON name - it is what the app maps back to an
  //    input on the form. Only `message` is Arabic, and it is already Arabic by
  //    the time it gets here: either the schema wrote it, or core/zod-arabic.ts
  //    supplied it.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: messages.validation.invalidRequest,
        details: err.issues.map((issue) => ({
          field: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      },
    });
    return;
  }

  // 3. A rejected upload: wrong type, too big, or a field name the route did
  //    not declare. Multer has already deleted whatever it wrote, so there is
  //    nothing to clean up here.
  if (err instanceof MulterError) {
    res.status(400).json({
      error: {
        code: "invalid_upload",
        message: uploadErrorMessage(err),
        details: { field: err.field },
      },
    });
    return;
  }

  // 4. Database constraint violations worth reporting precisely.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const fields = uniqueConstraintFields(err);
      res.status(409).json({
        error: {
          code: "conflict",
          message: messages.validation.alreadyInUse(fields),
          // The raw column names, untranslated - `details` is for the app.
          details: { fields },
        },
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        error: { code: "not_found", message: messages.generic.notFound },
      });
      return;
    }

    if (err.code === "P2003") {
      res.status(409).json({
        error: { code: "conflict", message: foreignKeyMessage(err) },
      });
      return;
    }
  }

  // 5. Anything else is a bug. Log it in full, tell the client nothing.
  //
  //    `details` stays as the raw English exception outside production: it is
  //    for whoever is debugging, not for the user, and translating a stack
  //    trace would only make it harder to search for.
  console.error(err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: messages.generic.serverError,
      details: isProduction ? undefined : String(err),
    },
  });
}
