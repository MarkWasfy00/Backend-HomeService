import type { NextFunction, Request, Response } from "express";
import type { User } from "../../generated/prisma/client.js";
import type { UserRole } from "../../generated/prisma/enums.js";
import { ApiError } from "../../core/errors.js";
import { messages } from "../../core/messages.js";
import { findUserById } from "../users/users.service.js";
import { assertAccountIsUsable } from "./auth.service.js";
import { verifyToken } from "./auth.tokens.js";

/**
 * The two guards the API is built around. They are applied once per audience
 * group in src/api/index.ts:
 *
 *   apiRouter.use("/admin", requireAuth, requireRole("ADMIN"), adminRouter);
 *
 * No route file checks permissions itself, so "who may call this" is answered
 * in exactly one place and cannot drift.
 *
 * Express 5 forwards a rejected promise from a middleware to the error handler
 * just like it does from a route, so these throw instead of calling next(err).
 */

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by `requireAuth`, absent everywhere else. Read it with
       * `currentUser(req)` rather than touching it directly - that helper is
       * typed as always present, which is true on any route behind the guard.
       */
      auth?: { user: User };
    }
  }
}

/**
 * The caller, on a route mounted behind `requireAuth`.
 *
 *   const user = currentUser(req);   // never null
 *
 * Throwing here is not a 401 - a missing `req.auth` means a route was mounted
 * without the guard, which is our bug, and a 500 is the honest answer.
 */
export function currentUser(req: Request): User {
  if (!req.auth) {
    throw new Error(
      "currentUser() was called on a route that is not behind requireAuth",
    );
  }

  return req.auth.user;
}

/** Pulls the token out of `Authorization: Bearer <token>`. */
function bearerToken(req: Request): string {
  const header = req.header("authorization");
  const match = header?.match(/^Bearer +(.+)$/i);

  if (!match?.[1]) {
    throw ApiError.unauthorized(messages.auth.missingBearerToken);
  }

  return match[1].trim();
}

/**
 * Rejects anyone without a valid access token, and hands everyone else to the
 * route with `req.auth.user` filled in.
 *
 * The user row is re-read on every request rather than trusted from the token,
 * because the two things the guards care about - `role` and `status` - both
 * change while a session is alive. That is what makes blocking a user take
 * effect immediately and keeps a token minted before the "customer or
 * technician?" screen from being stuck on the wrong role.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const userId = verifyToken(bearerToken(req), "access");
  const user = await findUserById(userId);

  // Signed correctly, but the account was deleted since. Not a 404: as far as
  // the caller is concerned their session is simply no longer good.
  if (!user) {
    throw ApiError.unauthorized(messages.auth.accountGone);
  }

  assertAccountIsUsable(user);

  req.auth = { user };
  next();
}

/**
 * Restricts a group to certain roles. Always mounted *after* `requireAuth`,
 * which is what put the user on the request.
 *
 * Note what this deliberately does not check: `status`. A PENDING user is
 * halfway through onboarding and still has to reach POST /customer/profile or
 * POST /technician/profile - locking them out of their own audience group
 * would strand them. BLOCKED and SUSPENDED are already gone, rejected by
 * requireAuth.
 */
export function requireRole(...roles: UserRole[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction) {
    const user = currentUser(req);

    if (!roles.includes(user.role)) {
      throw ApiError.forbidden(messages.auth.roleNotAllowed(roles));
    }

    next();
  };
}
