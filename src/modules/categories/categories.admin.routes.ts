import { Router } from "express";
import { ApiError } from "../../core/errors.js";

/**
 * TASK 1 - back-office management of the service categories.
 * Mounted at /api/v1/admin/categories.
 *
 * Reference: src/modules/users/users.admin.routes.ts - same structure, fewer
 * fields. Remember: parse first, call the service, map the result. No SQL and
 * no try/catch in this file.
 */
export const categoriesAdminRoutes = Router();

/** GET /api/v1/admin/categories/:id */
categoriesAdminRoutes.get("/:id", async (_req, res) => {
  // TODO(task 1): parse categoryIdParams, getCategoryById, 200 with the mapped row
  throw ApiError.notImplemented();
});

/** POST /api/v1/admin/categories */
categoriesAdminRoutes.post("/", async (_req, res) => {
  // TODO(task 1): parse createCategoryBody, createCategory, 201 with the mapped row
  throw ApiError.notImplemented();
});

/** PATCH /api/v1/admin/categories/:id */
categoriesAdminRoutes.patch("/:id", async (_req, res) => {
  // TODO(task 1): parse params + updateCategoryBody, updateCategory, 200
  throw ApiError.notImplemented();
});

/** DELETE /api/v1/admin/categories/:id */
categoriesAdminRoutes.delete("/:id", async (_req, res) => {
  // TODO(task 1): parse params, deleteCategory, then `res.status(204).end()`
  throw ApiError.notImplemented();
});
