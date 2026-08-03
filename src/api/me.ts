import { Router } from "express";
import { usersMeRoutes } from "../modules/users/users.me.routes.js";

/**
 * "My own account", under /api/v1/me. Every endpoint here acts on the caller,
 * identified by the token - no `:id` anywhere.
 *
 * Unlike the other four groups this one is not tied to a role: a customer, a
 * technician and an admin all have an account, and all read it the same way.
 * Role-specific work belongs in that role's group instead.
 */
export const meRouter = Router();

// GET /api/v1/me            who am I + which screen comes next
// PATCH /api/v1/me/role     the "customer or technician?" screen
// POST /api/v1/me/signup    role + profile + documents, all in one call
//
// Signup lives here rather than in /customer or /technician for the reason
// this group exists: those two are behind `requireRole`, and the role is
// exactly what that endpoint is being told - it cannot also be the guard.
meRouter.use("/", usersMeRoutes);
