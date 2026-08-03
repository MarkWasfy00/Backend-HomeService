import { Router } from "express";
import * as categoriesService from "./categories.service.js";
import { toCategoryResponse } from "./categories.mapper.js";
import {
  categoryIdParams,
  createCategoryBody,
  updateCategoryBody,
} from "./categories.schema.js";

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
categoriesAdminRoutes.get("/:id", async (req, res) => {
  const { id } = categoryIdParams.parse(req.params);
  const category = await categoriesService.getCategoryById(id);
  res.json({ data: toCategoryResponse(category) });
});

/** POST /api/v1/admin/categories */
categoriesAdminRoutes.post("/", async (req, res) => {
  const body = createCategoryBody.parse(req.body);
  const category = await categoriesService.createCategory(body);
  res.status(201).json({ data: toCategoryResponse(category) });
});

/** PATCH /api/v1/admin/categories/:id */
categoriesAdminRoutes.patch("/:id", async (req, res) => {
  const { id } = categoryIdParams.parse(req.params);
  const body = updateCategoryBody.parse(req.body);
  const category = await categoriesService.updateCategory(id, body);
  res.json({ data: toCategoryResponse(category) });
});

/** DELETE /api/v1/admin/categories/:id */
categoriesAdminRoutes.delete("/:id", async (req, res) => {
  const { id } = categoryIdParams.parse(req.params);
  await categoriesService.deleteCategory(id);
  res.status(204).end();
});