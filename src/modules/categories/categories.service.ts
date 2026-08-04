import { prisma } from "../../core/prisma.js";
import { ApiError } from "../../core/errors.js";
import { messages } from "../../core/messages.js";
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
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

/** One category, or a 404 if it does not exist. */
export async function getCategoryById(id: bigint) {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw ApiError.notFound(messages.categories.notFound);
  }

  return category;
}

export async function createCategory(data: CreateCategoryBody) {
  // `name` is unique in the schema, so a duplicate already becomes a 409 by
  // itself (Prisma's P2002) - do not check for one first.
  return prisma.category.create({ data });
}

export async function updateCategory(id: bigint, data: UpdateCategoryBody) {
  // A missing row raises Prisma's P2025, which the error handler already
  // turns into a 404 - nothing to catch here.
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: bigint) {
  // Careful: technicians and service requests point at a category, so
  // deleting one that is in use raises P2003 -> 409. That is the correct
  // behaviour; no extra handling needed here.
  return prisma.category.delete({ where: { id } });
}
