import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "./errors.js";
import { isProduction } from "./env.js";

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
    return "A record this refers to does not exist";
  }

  if (original.startsWith("update or delete")) {
    return "This record is still referenced by other records";
  }

  // An older Prisma, or a driver that words it differently. Both halves, since
  // there is no way to tell which one it was.
  return "A record this refers to does not exist, or this record is still referenced by other records";
}

/**
 * Multer reports a rejected upload with a code rather than a sentence, and its
 * own messages ("File too large") say nothing about which field or what the
 * limit is. These do.
 *
 * The limits themselves live in modules/uploads/uploads.storage.ts - this only
 * describes them, so keep the two in step.
 */
function uploadErrorMessage(err: MulterError): string {
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return `${err.field} is larger than the 5 MB limit`;
    case "LIMIT_UNEXPECTED_FILE":
      return `${err.field} is not a file this endpoint accepts`;
    case "LIMIT_FILE_COUNT":
      return "Too many files in one request";
    case "LIMIT_PART_COUNT":
      return "Too many parts in the form";
    default:
      return err.message;
  }
}

/** Runs when no route matched the URL. */
export function notFoundHandler(req: Request, res: Response<ErrorBody>) {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `Cannot ${req.method} ${req.originalUrl}`,
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
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "The request body or query is invalid",
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
          message: fields.length
            ? `${fields.join(", ")} is already in use`
            : "That value is already in use",
          details: { fields },
        },
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        error: { code: "not_found", message: "Resource not found" },
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
  console.error(err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
      details: isProduction ? undefined : String(err),
    },
  });
}
