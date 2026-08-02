import { Router } from "express";
import { authPublicRoutes } from "../modules/auth/auth.public.routes.js";
import { usersPublicRoutes } from "../modules/users/users.public.routes.js";
import { categoriesPublicRoutes } from "../modules/categories/categories.public.routes.js";
import { uploadsPublicRoutes } from "../modules/uploads/uploads.public.routes.js";

/**
 * Endpoints open to anyone, under /api/v1/public.
 *
 * Login lives here because it is how a user gets in - it cannot require
 * already being in. The category list is here because onboarding shows it
 * before the account is finished.
 */
export const publicRouter = Router();

publicRouter.use("/auth", authPublicRoutes);
publicRouter.use("/onboarding", usersPublicRoutes);
publicRouter.use("/categories", categoriesPublicRoutes); // task 1
publicRouter.use("/uploads", uploadsPublicRoutes); // task 4
