import { z } from "zod";
import { idParams } from "../../core/fields.js";
import { messages } from "../../core/messages.js";

// TASK 1 - Categories. See docs/ONBOARDING-FLOW.md.
// Copy the shape of src/modules/users/users.schema.ts.

/** `:id` in the URL. Already done - BigInt parsing is shared. */
export const categoryIdParams = idParams;

const name = z.string().trim().min(2).max(100);

// Accepts a number or a numeric string on the way in, but always comes out
// as a fixed 2dp string - the route/service should never see a float.
const homeVisitBasePrice = z.coerce
  .number()
  .positive()
  .max(99_999_999.99)
  .refine((n) => Number(n.toFixed(2)) === n, {
    message: messages.fields.priceDecimals,
  })
  .transform((n) => n.toFixed(2));

/**
 * POST /admin/categories
 */
export const createCategoryBody = z.object({
  name,
  homeVisitBasePrice,
});

/**
 * PATCH /admin/categories/:id
 *
 * Same fields as create, all optional, but reject an empty body - same
 * pattern as `updateUserBody`.
 */
export const updateCategoryBody = createCategoryBody
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: messages.fields.atLeastOneFieldToUpdate,
  });

export type CreateCategoryBody = z.infer<typeof createCategoryBody>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBody>;
