import { Router } from "express";
import * as categoriesService from "./categories.service.js";
import { toCategoryResponse } from "./categories.mapper.js";

/**
 * TASK 1 - the list customers and technicians pick from during onboarding
 * (screen 3: "what field are you looking for?").
 *
 * Mounted at /api/v1/public/categories - open, because it is needed before
 * anyone has an account.
 */
export const categoriesPublicRoutes = Router();

/** GET /api/v1/public/categories */
categoriesPublicRoutes.get("/", async (_req, res) => {
  const categories = await categoriesService.listCategories();

  // No `meta` - this endpoint is not paginated.
  res.json({ data: categories.map(toCategoryResponse) });
});
