import { Router } from "express";
import { publicRouter } from "./public.js";
import { customerRouter } from "./customer.js";
import { technicianRouter } from "./technician.js";
import { adminRouter } from "./admin.js";

/**
 * The whole API surface, split by *audience* - who each endpoint is for.
 *
 *   /api/v1/public      open to anyone
 *   /api/v1/customer    customer-facing
 *   /api/v1/technician  technician-facing
 *   /api/v1/admin       back-office
 *
 * There is no authentication yet, so every endpoint below is open. Grouping
 * them by audience now means adding auth later is a one-line change per group
 * *in this file only* - no route file has to be touched, because none of them
 * check permissions themselves:
 *
 *   apiRouter.use("/admin", requireAuth, requireRole("ADMIN"), adminRouter);
 *
 * A "/me" group ("my own account") will be added at the same time - it needs
 * to know who is calling, so it cannot exist before auth does.
 */
export const apiRouter = Router();

apiRouter.use("/public", publicRouter);
apiRouter.use("/customer", customerRouter);
apiRouter.use("/technician", technicianRouter);
apiRouter.use("/admin", adminRouter);
