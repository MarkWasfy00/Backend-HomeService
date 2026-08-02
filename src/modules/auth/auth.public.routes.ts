import { Router } from "express";
import { toUserResponse } from "../users/users.mapper.js";
import {
  accountStateMessage,
  resolveAccountState,
} from "../users/users.state.js";
import * as authService from "./auth.service.js";
import { requestOtpBody, verifyOtpBody } from "./auth.schema.js";

/**
 * Phone login, mounted at /api/v1/public/auth. Open by definition - this is
 * how a user gets in, so it cannot require being in.
 *
 * Two steps: ask for a code, then send it back.
 */
export const authPublicRoutes = Router();

/** POST /api/v1/public/auth/request-otp */
authPublicRoutes.post("/request-otp", async (req, res) => {
  const { phone } = requestOtpBody.parse(req.body);
  const result = await authService.requestOtp(phone);

  res.json({ data: result });
});

/** POST /api/v1/public/auth/verify-otp */
authPublicRoutes.post("/verify-otp", async (req, res) => {
  const { phone, otpCode } = verifyOtpBody.parse(req.body);
  const { user, technicianProfile, isNewUser } = await authService.verifyOtp(
    phone,
    otpCode,
  );

  const accountState = resolveAccountState(user, technicianProfile);

  res.json({
    data: {
      user: toUserResponse(user),
      isNewUser,
      // Which screen to show next. A technician who already sent their
      // documents gets WAITING_FOR_APPROVAL every time they open the app,
      // until an admin approves them - they are never asked to onboard twice.
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});
