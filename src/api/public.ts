import { Router } from "express";
import { authPublicRoutes } from "../modules/auth/auth.public.routes.js";
import { categoriesPublicRoutes } from "../modules/categories/categories.public.routes.js";
import { uploadsPublicRoutes } from "../modules/uploads/uploads.public.routes.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

/**
 * Endpoints open to anyone, under /api/v1/public.
 *
 * Login lives here because it is how a user gets in - it cannot require
 * already being in, and neither can refreshing an expired token. The category
 * list is here because onboarding shows it before the account is finished.
 *
 * Everything else needs a token. The rest of onboarding - picking a role,
 * submitting a profile - moved to /me and the role groups once auth landed:
 * those steps act on *the caller*, and there is no way to say who that is
 * without a token.
 */
export const publicRouter = Router();

publicRouter.use("/auth", authPublicRoutes);
publicRouter.use("/categories", categoriesPublicRoutes); // task 1

// Task 4. Left public so the scaffolded task keeps the URL it documents, but
// it is the one endpoint here that writes to disk on a stranger's say-so.
// Worth moving behind `requireAuth` once it is implemented - a technician
// always has a token by the time they upload their documents.
publicRouter.use("/uploads", requireAuth, uploadsPublicRoutes);
