import type { Category } from "../../generated/prisma/client.js";

// TASK 1 - Categories. Reference: src/modules/users/users.mapper.ts.

/**
 * Turns a database row into the JSON the API returns.
 *
 * Both conversions matter: a BigInt crashes JSON.stringify, and a price sent
 * as a float silently loses precision.
 */
export function toCategoryResponse(category: Category) {
  return {
    id: category.id.toString(),
    name: category.name,
    homeVisitBasePrice: category.homeVisitBasePrice.toFixed(2),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export type CategoryResponse = ReturnType<typeof toCategoryResponse>;
