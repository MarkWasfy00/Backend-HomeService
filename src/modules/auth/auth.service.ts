import type { User } from "../../generated/prisma/client.js";
import { prisma } from "../../core/prisma.js";
import { ApiError } from "../../core/errors.js";
import { isProduction } from "../../core/env.js";
import { sendOtpSms } from "./auth.sms.js";
import { issueTokens, verifyToken } from "./auth.tokens.js";

// All the tuning knobs in one place, so nobody has to hunt for a magic number.
const OTP_TTL_MINUTES = 5; // how long a code stays valid
const MAX_ATTEMPTS = 5; // wrong guesses before we lock the phone out
const BLOCK_MINUTES = 15; // how long that lockout lasts
const RESEND_COOLDOWN_SECONDS = 60; // gap between two "send me a code" requests

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60_000);
}

/** A zero-padded 6 digit code, e.g. "042931". */
function generateOtpCode() {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

/** 429 - the client asked too often, or guessed too many times. */
function tooManyRequests(message: string) {
  return new ApiError(429, "too_many_requests", message);
}

/** The newest code we sent to this phone, or null if we never sent one. */
function findLatestOtp(phone: string) {
  return prisma.otp.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
}

/**
 * Step 1 of login: generate a code and text it to the phone.
 *
 * The same call handles sign-up and sign-in - we do not know or care yet
 * whether this phone belongs to an existing user. That keeps the client simple
 * and avoids telling a stranger which numbers are registered.
 */
export async function requestOtp(phone: string) {
  const latest = await findLatestOtp(phone);
  const now = new Date();

  if (latest?.blockedUntil && latest.blockedUntil > now) {
    throw tooManyRequests(
      "Too many wrong codes. Try again in a few minutes.",
    );
  }

  if (latest) {
    const secondsSinceLast = (now.getTime() - latest.createdAt.getTime()) / 1000;

    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
      throw tooManyRequests(`Wait ${wait}s before asking for another code.`);
    }
  }

  const otpCode = generateOtpCode();
  const expiresAt = minutesFromNow(OTP_TTL_MINUTES);

  await prisma.otp.create({ data: { phone, otpCode, expiresAt } });
  await sendOtpSms(phone, otpCode);

  return {
    expiresAt,
    // A convenience so the team can test without an SMS provider. It is
    // stripped in production, where sendOtpSms refuses to run anyway.
    devOtpCode: isProduction ? undefined : otpCode,
  };
}

/**
 * Step 2 of login: check the code, then hand back the user and their tokens.
 *
 * If the phone has never been seen, a user row is created here with nothing
 * but the phone number - that is the "account" the app then asks to complete.
 * `isNewUser` tells the client whether to show onboarding or go straight in.
 *
 * The tokens are issued to a PENDING user as well, on purpose: onboarding
 * itself (picking a role, submitting a profile) happens over authenticated
 * endpoints, so the session has to start before the account is finished.
 */
export async function verifyOtp(phone: string, otpCode: string) {
  const otp = await findLatestOtp(phone);
  const now = new Date();

  if (!otp) {
    throw ApiError.badRequest("Ask for a code first");
  }

  if (otp.blockedUntil && otp.blockedUntil > now) {
    throw tooManyRequests("Too many wrong codes. Try again in a few minutes.");
  }

  if (otp.verifiedAt) {
    throw ApiError.badRequest("This code was already used");
  }

  if (otp.expiresAt < now) {
    throw ApiError.badRequest("This code has expired, ask for a new one");
  }

  if (otp.otpCode !== otpCode) {
    const attempts = otp.attempts + 1;
    const isBlocked = attempts >= MAX_ATTEMPTS;

    await prisma.otp.update({
      where: { id: otp.id },
      data: {
        attempts,
        blockedUntil: isBlocked ? minutesFromNow(BLOCK_MINUTES) : null,
      },
    });

    if (isBlocked) {
      throw tooManyRequests(
        `Too many wrong codes. Try again in ${BLOCK_MINUTES} minutes.`,
      );
    }

    throw ApiError.badRequest(
      `Wrong code. ${MAX_ATTEMPTS - attempts} attempt(s) left.`,
    );
  }

  // Burn the code so it cannot be replayed.
  await prisma.otp.update({
    where: { id: otp.id },
    data: { verifiedAt: now },
  });

  const account = await findOrCreateUserByPhone(phone);

  return { ...account, tokens: issueTokens(account.user.id) };
}

/**
 * Trades a refresh token for a fresh pair, so a session can outlive its access
 * token without sending another SMS.
 *
 * The user row is re-read here rather than trusted from the token - that is
 * what stops a blocked or deleted account from renewing itself indefinitely.
 * The account state comes back too, because a lot can have changed since the
 * app last asked: an admin may have approved the technician who was waiting.
 */
export async function refreshSession(refreshToken: string) {
  const userId = verifyToken(refreshToken, "refresh");

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { technicianProfile: true },
  });

  if (!user) {
    throw ApiError.unauthorized("This account no longer exists");
  }

  assertAccountIsUsable(user);

  return {
    user,
    technicianProfile: user.technicianProfile,
    tokens: issueTokens(user.id),
  };
}

/**
 * Moderation, enforced in the one place every session passes through: login,
 * refresh, and every authenticated request (see auth.middleware.ts).
 *
 * BLOCKED and SUSPENDED are the two statuses that revoke access. PENDING is
 * not one of them - that is just an unfinished profile.
 */
export function assertAccountIsUsable(user: User) {
  if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
    throw ApiError.forbidden(`This account is ${user.status.toLowerCase()}`);
  }
}

/**
 * A verified phone always ends up with a user row. New phones get an almost
 * empty one - only the phone is known at this point, everything else is filled
 * in by the onboarding screens that follow.
 *
 * The technician profile is loaded alongside it because the caller needs both
 * to work out which screen comes next (see users.state.ts) - a technician
 * waiting for approval must not be sent back through onboarding.
 */
async function findOrCreateUserByPhone(phone: string) {
  const existing = await prisma.user.findFirst({
    where: { phone, deletedAt: null },
    include: { technicianProfile: true },
  });

  if (existing) {
    assertAccountIsUsable(existing);

    return {
      user: existing,
      technicianProfile: existing.technicianProfile,
      isNewUser: false,
    };
  }

  const user = await prisma.user.create({ data: { phone } });

  return { user, technicianProfile: null, isNewUser: true };
}
