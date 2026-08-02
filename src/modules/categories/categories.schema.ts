import { z } from "zod";
import { idParams } from "../../core/fields.js";

// TASK 1 - Categories. See docs/ONBOARDING-FLOW.md.
// Copy the shape of src/modules/users/users.schema.ts.

/** `:id` in the URL. Already done - BigInt parsing is shared. */
export const categoryIdParams = idParams;

/**
 * POST /admin/categories
 *
 * TODO: add the fields.
 *   name                 string, trimmed, 2-100 chars
 *   homeVisitBasePrice   a positive number, max 2 decimal places
 *
 * Money tip: accept it as a number or a string here, but store and return it
 * as a string. Never let a price become a JS float.
 */
export const createCategoryBody = z.object({});

/**
 * PATCH /admin/categories/:id
 *
 * TODO: same fields as create, all optional, but reject an empty body.
 * `createCategoryBody.partial().refine(...)` - see updateUserBody for the
 * exact pattern.
 */
export const updateCategoryBody = z.object({});

export type CreateCategoryBody = z.infer<typeof createCategoryBody>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBody>;
