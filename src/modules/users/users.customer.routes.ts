import { Router } from "express";
import { ApiError } from "../../core/errors.js";

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
usersCustomerRoutes.post("/", async (_req, res) => {
  // TODO(task 2):
  //   1. add `createCustomerProfileBody` to users.schema.ts:
  //        userId  + the five profileFields (fullName, city, address,
  //        latitude, longitude) - all required here, even though the columns
  //        are nullable. Nullable means "not filled in yet"; this is the
  //        screen that fills them in.
  //   2. call a `completeCustomerProfile` service function that writes those
  //      fields AND sets status to ACTIVE in the same update - reuse
  //      updateUserFields in users.service.ts, do not write a new Prisma call
  //   3. reply 201 with the same envelope the technician endpoint uses:
  //        {
  //          data: {
  //            user: toUserResponse(user),
  //            accountState,                        // -> "READY"
  //            message: accountStateMessage[accountState],
  //          }
  //        }
  //      Get the state from resolveAccountState(user, null) rather than
  //      hardcoding "READY" - one function decides states, always.
  //
  // Reject a user who already finished (status !== PENDING) with a 409, the
  // way selectRole does.
  throw ApiError.notImplemented();
});
