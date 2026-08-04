import { z } from "zod";
import { phoneField } from "../../core/fields.js";
import { messages } from "../../core/messages.js";

/** POST /public/auth/request-otp */
export const requestOtpBody = z.object({
  phone: phoneField,
});

/** POST /public/auth/verify-otp */
export const verifyOtpBody = z.object({
  phone: phoneField,
  otpCode: z.string().trim().regex(/^\d{6}$/, messages.fields.otpCode),
});

/**
 * POST /public/auth/refresh
 *
 * The refresh token travels in the body, not in the Authorization header: that
 * header carries access tokens, and this is the one endpoint where sending the
 * other kind is correct.
 */
export const refreshBody = z.object({
  refreshToken: z.string().trim().min(1),
});
