import { Router } from "express";
import { currentUser } from "../auth/auth.middleware.js";
import { toUserResponse } from "../users/users.mapper.js";
import {
  accountStateMessage,
  resolveAccountState,
} from "../users/users.state.js";
import { toTechnicianProfileResponse } from "./technicians.mapper.js";
import { createTechnicianProfileBody } from "./technicians.schema.js";
import * as techniciansService from "./technicians.service.js";

/**
 * TASK 3 - screen 5b: the technician submits their details and documents,
 * then waits for an admin.
 *
 *   POST /api/v1/technician/profile
 *
 * The twin of POST /api/v1/customer/profile. Same idea, bigger payload: a
 * technician never sees the customer profile page, so this one call carries
 * their personal details *and* their national id / criminal record.
 *
 * Unlike the customer endpoint this really does create a row - the
 * TechnicianProfile - on top of filling in the existing User.
 */
export const techniciansTechnicianRoutes = Router();

/** POST /api/v1/technician/profile */
techniciansTechnicianRoutes.post("/", async (req, res) => {
  const body = createTechnicianProfileBody.parse(req.body);

  // Whose profile this is comes from the token, never from the body - the
  // group is already behind requireAuth + requireRole("TECHNICIAN").
  const { user, technicianProfile } =
    await techniciansService.createTechnicianProfile(
      currentUser(req).id,
      body,
    );

  // resolveAccountState decides this, never the route - the same function the
  // login response uses, so the app gets the identical answer either way. It
  // comes back with the profile so the "under review" screen can be shown
  // straight away, without a second call.
  const accountState = resolveAccountState(user, technicianProfile);

  res.status(201).json({
    data: {
      user: toUserResponse(user),
      technicianProfile: toTechnicianProfileResponse(technicianProfile),
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});
