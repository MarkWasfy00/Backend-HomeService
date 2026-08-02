import type { NextFunction, Request, Response } from "express";
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

  // 3. Database constraint violations worth reporting precisely.
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
        error: {
          code: "conflict",
          message: "This record is still referenced by other records",
        },
      });
      return;
    }
  }

  // 4. Anything else is a bug. Log it in full, tell the client nothing.
  console.error(err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
      details: isProduction ? undefined : String(err),
    },
  });
}
