import { Router } from "express";
import { usersCustomerRoutes } from "../modules/users/users.customer.routes.js";

/**
 * Customer-facing endpoints, under /api/v1/customer.
 *
 * Service requests will land here once that module is built:
 *   customerRouter.use("/requests", requestsCustomerRoutes);
 */
export const customerRouter = Router();

// POST /api/v1/customer/profile - the customer half of "create my profile".
// Its twin is POST /api/v1/technician/profile in api/technician.ts.
customerRouter.use("/profile", usersCustomerRoutes); // task 2
