import { Router } from "express";
import { techniciansTechnicianRoutes } from "../modules/technicians/technicians.technician.routes.js";

/**
 * Technician-facing endpoints, under /api/v1/technician.
 *
 * Offers on service requests will land here once that module is built:
 *   technicianRouter.use("/offers", offersTechnicianRoutes);
 */
export const technicianRouter = Router();

// POST /api/v1/technician/profile - the technician half of "create my
// profile". Its twin is POST /api/v1/customer/profile in api/customer.ts.
technicianRouter.use("/profile", techniciansTechnicianRoutes); // task 3
