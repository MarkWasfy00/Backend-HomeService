import { ApiError } from "../../core/errors.js";
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "./categories.schema.js";

// TASK 1 - Categories. All database access for categories goes in this file.
// No `req` or `res` in here. Reference: src/modules/users/users.service.ts.
//
// The Category model has no `deletedAt`, so unlike users there is no
// soft-delete filter to remember - a delete is a real delete.

/**
 * Every category, ordered by name.
 *
 * There are only a handful, so no pagination - return a plain array.
 */
export async function listCategories() {
  // TODO(task 1): prisma.category.findMany({ orderBy: { name: "asc" } })
  throw ApiError.notImplemented();
}

/** One category, or a 404 if it does not exist. */
export async function getCategoryById(id: bigint) {
  // TODO(task 1): findUnique, then `throw ApiError.notFound("Category not found")`
  // if it came back null. Copy getUserById.
  throw ApiError.notImplemented();
}

export async function createCategory(data: CreateCategoryBody) {
  // TODO(task 1): prisma.category.create({ data }).
  // `name` is unique in the schema, so a duplicate already becomes a 409 by
  // itself - do not check for one first.
  throw ApiError.notImplemented();
}

export async function updateCategory(id: bigint, data: UpdateCategoryBody) {
  // TODO(task 1): prisma.category.update. A missing row raises P2025, which
  // the error handler already turns into a 404.
  throw ApiError.notImplemented();
}

export async function deleteCategory(id: bigint) {
  // TODO(task 1): prisma.category.delete.
  // Careful: technicians and service requests point at a category, so deleting
  // one that is in use raises P2003 -> 409. That is the correct behaviour;
  // you do not need to handle it here.
  throw ApiError.notImplemented();
}
