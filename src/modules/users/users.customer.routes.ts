import { Router } from "express";
import { currentUser } from "../auth/auth.middleware.js";
import { toUserResponse } from "./users.mapper.js";
import { accountStateMessage, resolveAccountState } from "./users.state.js";
import { createCustomerProfileBody } from "./users.schema.js";
import * as usersService from "./users.service.js";

/**
 * TASK 2 - screen 5a: the customer fills in the profile that was left empty
 * when their phone was verified.
 *
 *   POST /api/v1/customer/profile
 *
 * The twin of POST /api/v1/technician/profile. The app picked one or the other
 * back on the "customer or technician?" screen; from the frontend's point of
 * view they are the same call with a different payload and a different URL.
 *
 * Note this does not create a *user* - that row already exists, created the
 * moment the OTP was verified. It fills in the blanks and activates it.
 */
export const usersCustomerRoutes = Router();

/** POST /api/v1/customer/profile */
usersCustomerRoutes.post("/", async (req, res) => {
  const body = createCustomerProfileBody.parse(req.body);

  // Whose profile this is comes from the token, never from the body - the
  // group is already behind requireAuth + requireRole("CUSTOMER").
  const user = await usersService.completeCustomerProfile(
    currentUser(req).id,
    body,
  );

  // "READY", but resolveAccountState says so rather than this route - the same
  // function login and GET /me use, so the app gets the identical answer
  // whichever call it learns the state from. A customer never has a technician
  // profile, hence the null.
  const accountState = resolveAccountState(user, null);

  res.status(201).json({
    data: {
      user: toUserResponse(user),
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});
