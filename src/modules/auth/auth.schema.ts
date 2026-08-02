import { z } from "zod";
import { phoneField } from "../../core/fields.js";

/** POST /public/auth/request-otp */
export const requestOtpBody = z.object({
  phone: phoneField,
});

/** POST /public/auth/verify-otp */
export const verifyOtpBody = z.object({
  phone: phoneField,
  otpCode: z.string().trim().regex(/^\d{6}$/, "otpCode must be 6 digits"),
});
