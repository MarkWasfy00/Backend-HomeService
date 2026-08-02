import { Router } from "express";
import { ApiError } from "../../core/errors.js";

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
  // TODO(task 1):
  //   const categories = await categoriesService.listCategories();
  //   res.json({ data: categories.map(toCategoryResponse) });
  // No `meta` - this endpoint is not paginated.
  throw ApiError.notImplemented();
});
