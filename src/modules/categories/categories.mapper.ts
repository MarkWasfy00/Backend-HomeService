import type { Category } from "../../generated/prisma/client.js";
import { ApiError } from "../../core/errors.js";

// TASK 1 - Categories. Reference: src/modules/users/users.mapper.ts.

/**
 * Turns a database row into the JSON the API returns.
 *
 * TODO(task 1): return
 *   id                  category.id.toString()      BigInt -> string
 *   name
 *   homeVisitBasePrice  category.homeVisitBasePrice.toString()   Decimal -> string
 *   createdAt, updatedAt
 *
 * Both conversions matter: a BigInt crashes JSON.stringify, and a price sent
 * as a float silently loses precision.
 */
export function toCategoryResponse(category: Category) {
  throw ApiError.notImplemented();
}
