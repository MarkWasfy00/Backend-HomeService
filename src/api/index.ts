import { Router } from "express";
import { requireAuth, requireRole } from "../modules/auth/auth.middleware.js";
import { publicRouter } from "./public.js";
import { meRouter } from "./me.js";
import { customerRouter } from "./customer.js";
import { technicianRouter } from "./technician.js";
import { adminRouter } from "./admin.js";

/**
 * The whole API surface, split by *audience* - who each endpoint is for.
 *
 *   /api/v1/public      open to anyone
 *   /api/v1/me          the caller's own account, any role
 *   /api/v1/customer    customer-facing
 *   /api/v1/technician  technician-facing
 *   /api/v1/admin       back-office
 *
 * **This file is the entire access control policy.** No route, service, schema
 * or mapper checks permissions itself, so there is exactly one place to read
 * to know who can call what - and one place to get it wrong.
 *
 * `requireAuth` rejects anyone without a valid access token and puts the user
 * on the request; `requireRole` narrows the group to a role. Both live in
 * modules/auth/auth.middleware.ts.
 */
export const apiRouter = Router();

apiRouter.use("/public", publicRouter);

apiRouter.use("/me", requireAuth, meRouter);

// The role guards are what keep the audiences honest: a technician's token
// cannot reach a customer endpoint even though the two forms look alike.
//
// PENDING users pass these on purpose - they are mid-onboarding and still have
// to reach POST /customer/profile or POST /technician/profile, which is what
// makes them ACTIVE. A brand new user is CUSTOMER by default and becomes a
// TECHNICIAN the moment they pick that on PATCH /me/role.
apiRouter.use(
  "/customer",
  requireAuth,
  requireRole("CUSTOMER"),
  customerRouter,
);
apiRouter.use(
  "/technician",
  requireAuth,
  requireRole("TECHNICIAN"),
  technicianRouter,
);
apiRouter.use("/admin", requireAuth, requireRole("ADMIN"), adminRouter);
