import jwt from "jsonwebtoken";
import { env } from "../../core/env.js";
import { ApiError } from "../../core/errors.js";

/**
 * Signing and verifying JWTs. Pure functions - no database, no `req`/`res`, so
 * this is the only file that has to change if we ever move to RS256 or to a
 * different library.
 *
 * Two tokens are issued at login:
 *
 *   access   short-lived, sent on every request as `Authorization: Bearer …`
 *   refresh  long-lived, sent only to POST /public/auth/refresh to get a new
 *            access token without another SMS
 *
 * The access token is short *because it cannot be revoked* - there is no
 * session table, so a stolen one stays valid until it expires. Blocking a user
 * takes effect within ACCESS_TOKEN_TTL_MINUTES: the guard re-reads the user row
 * on every request (see auth.middleware.ts) and refreshing re-checks it too, so
 * a blocked account cannot renew.
 */

// Baked into every token and checked on the way back, so a token minted by
// another service that happens to share the secret is still rejected.
const ISSUER = "homeservice-api";

const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
const REFRESH_TTL_SECONDS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

/**
 * Which of the two a token is. It is part of the payload so a refresh token
 * cannot be replayed as an access token: the guard asks for "access" and a
 * refresh token fails the check even though its signature is perfectly valid.
 */
type TokenType = "access" | "refresh";

/**
 * What a token carries: the user id (in the standard `sub` claim) and nothing
 * else that could go stale.
 *
 * Deliberately no `role` or `status`. Both change *during* onboarding - a user
 * picks TECHNICIAN minutes after logging in, an admin blocks someone mid-session
 * - and a claim signed five minutes ago would still say otherwise. The guard
 * reads them from the database instead, which costs one query and is always
 * right.
 */
type TokenPayload = { typ: TokenType };

function sign(userId: bigint, typ: TokenType, expiresInSeconds: number) {
  return jwt.sign({ typ } satisfies TokenPayload, env.JWT_SECRET, {
    subject: userId.toString(),
    issuer: ISSUER,
    expiresIn: expiresInSeconds,
  });
}

/**
 * The pair handed back by login and refresh.
 *
 * `expiresIn` is seconds, so the app can schedule its own refresh instead of
 * waiting to be surprised by a 401.
 */
export function issueTokens(userId: bigint) {
  return {
    tokenType: "Bearer" as const,
    accessToken: sign(userId, "access", ACCESS_TTL_SECONDS),
    expiresIn: ACCESS_TTL_SECONDS,
    refreshToken: sign(userId, "refresh", REFRESH_TTL_SECONDS),
    refreshExpiresIn: REFRESH_TTL_SECONDS,
  };
}

export type IssuedTokens = ReturnType<typeof issueTokens>;

/**
 * Checks a token and returns whose it is.
 *
 * Every failure - bad signature, wrong issuer, expired, right signature but the
 * wrong *kind* of token - is a 401. The message distinguishes "expired" from
 * "invalid" because the app reacts differently: refresh in the first case, send
 * the user back to the login screen in the second.
 */
export function verifyToken(token: string, expected: TokenType): bigint {
  let payload: jwt.JwtPayload | string;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized(
        expected === "access"
          ? "Your session has expired, refresh it"
          : "Your session has expired, sign in again",
      );
    }

    throw ApiError.unauthorized("Invalid token");
  }

  // A token signed without `subject` decodes to a string payload. Ours never
  // is, but the type says it can be, and an unchecked cast here would be a
  // hole rather than a convenience.
  if (typeof payload === "string" || payload.typ !== expected) {
    throw ApiError.unauthorized("Invalid token");
  }

  if (!payload.sub || !/^\d+$/.test(payload.sub)) {
    throw ApiError.unauthorized("Invalid token");
  }

  return BigInt(payload.sub);
}
