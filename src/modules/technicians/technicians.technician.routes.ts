import { Router } from "express";
import { ApiError } from "../../core/errors.js";

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
techniciansTechnicianRoutes.post("/", async (_req, res) => {
  // TODO(task 3):
  //   const body = createTechnicianProfileBody.parse(req.body);
  //   const profile = await techniciansService.createTechnicianProfile(body);
  //
  // Then reply 201 with the profile AND the account state, so the app can go
  // straight to the "waiting for approval" screen without a second call:
  //
  //   res.status(201).json({
  //     data: {
  //       technicianProfile: toTechnicianProfileResponse(profile),
  //       accountState: "WAITING_FOR_APPROVAL",
  //       message: accountStateMessage.WAITING_FOR_APPROVAL,
  //     },
  //   });
  //
  // Import both from modules/users/users.state.js. Better still, call
  // resolveAccountState(user, profile) with the updated user so there is only
  // one place that decides the state.
  throw ApiError.notImplemented();
});
