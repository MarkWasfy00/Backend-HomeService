import { Router } from "express";
import { currentUser } from "../auth/auth.middleware.js";
import { toTechnicianProfileResponse } from "../technicians/technicians.mapper.js";
import * as techniciansService from "../technicians/technicians.service.js";
import { toUserResponse } from "./users.mapper.js";
import { accountStateMessage, resolveAccountState } from "./users.state.js";
import * as usersService from "./users.service.js";
import { selectRoleBody } from "./users.schema.js";

/**
 * "My own account", mounted at /api/v1/me behind `requireAuth`.
 *
 * Every endpoint here works on the caller and nobody else: there is no `:id`
 * in any of these URLs, because the id comes from the token. That is the whole
 * point of the group - it is impossible to write a handler here that touches
 * someone else's row by accident.
 */
export const usersMeRoutes = Router();

/**
 * GET /api/v1/me
 *
 * Who am I, and which screen should the app be on? The same answer login gives,
 * for an app that already has a token and is starting up again - it saves a
 * round trip through the SMS flow just to learn that a technician was approved.
 */
usersMeRoutes.get("/", async (req, res) => {
  const user = currentUser(req);
  const technicianProfile =
    await techniciansService.findTechnicianProfileByUserId(user.id);

  const accountState = resolveAccountState(user, technicianProfile);

  res.json({
    data: {
      user: toUserResponse(user),
      technicianProfile: technicianProfile
        ? toTechnicianProfileResponse(technicianProfile)
        : null,
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});

/**
 * PATCH /api/v1/me/role
 *
 * The "are you a customer or a technician?" screen. The answer decides which
 * screen comes next, which is why the reply carries `accountState`:
 *
 *   CUSTOMER   -> COMPLETE_PROFILE   open the app, go to the profile page
 *   TECHNICIAN -> SUBMIT_DOCUMENTS   go to the national id / criminal record
 *                                    form instead, then wait for approval
 *
 * The role on the token's own row changes here, so the app must call GET /me
 * (or simply carry on - the next request re-reads the row) rather than trust
 * anything it cached from login.
 */
usersMeRoutes.patch("/role", async (req, res) => {
  const { role } = selectRoleBody.parse(req.body);

  const { user, technicianProfile } = await usersService.selectRole(
    currentUser(req).id,
    role,
  );
  const accountState = resolveAccountState(user, technicianProfile);

  res.json({
    data: {
      user: toUserResponse(user),
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});
