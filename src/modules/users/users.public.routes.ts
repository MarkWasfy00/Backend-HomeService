import { Router } from "express";
import { toUserResponse } from "./users.mapper.js";
import { accountStateMessage, resolveAccountState } from "./users.state.js";
import * as usersService from "./users.service.js";
import { selectRoleBody, userIdParams } from "./users.schema.js";

/**
 * Onboarding steps that happen after the phone is verified but before the
 * account is finished. Mounted at /api/v1/public/onboarding.
 *
 * Public only because there is no auth yet. Once JWT lands this moves under
 * /me and the id comes from the token instead of the URL.
 */
export const usersPublicRoutes = Router();

/**
 * PATCH /api/v1/public/onboarding/:id/role
 *
 * The "are you a customer or a technician?" screen. The answer decides which
 * screen comes next, which is why the reply carries `accountState`:
 *
 *   CUSTOMER   -> COMPLETE_PROFILE   open the app, go to the profile page
 *   TECHNICIAN -> SUBMIT_DOCUMENTS   go to the national id / criminal record
 *                                    form instead, then wait for approval
 */
usersPublicRoutes.patch("/:id/role", async (req, res) => {
  const { id } = userIdParams.parse(req.params);
  const { role } = selectRoleBody.parse(req.body);

  const { user, technicianProfile } = await usersService.selectRole(id, role);
  const accountState = resolveAccountState(user, technicianProfile);

  res.json({
    data: {
      user: toUserResponse(user),
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});
