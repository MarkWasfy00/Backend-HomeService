import { Router } from "express";
import { adminUsersRoutes } from "../modules/users/users.admin.routes.js";
import { categoriesAdminRoutes } from "../modules/categories/categories.admin.routes.js";
import { techniciansAdminRoutes } from "../modules/technicians/technicians.admin.routes.js";

/**
 * Everything the back-office can do, under /api/v1/admin.
 *
 * Permissions are not checked here or in any route file - when auth arrives it
 * goes on this whole group in api/index.ts.
 */
export const adminRouter = Router();

adminRouter.use("/users", adminUsersRoutes);
adminRouter.use("/categories", categoriesAdminRoutes); // task 1
adminRouter.use("/technicians", techniciansAdminRoutes); // task 5
