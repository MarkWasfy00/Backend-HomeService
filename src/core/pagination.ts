import { z } from "zod";

/**
 * Shared `?page=&limit=` query parsing. Extend it in a module like this:
 *
 *   export const listUsersQuery = paginationQuery.extend({ city: z.string() });
 */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;

/** Turns `{ page, limit }` into the `skip`/`take` Prisma expects. */
export function skipTake({ page, limit }: Pagination) {
  return { skip: (page - 1) * limit, take: limit };
}

/** The `meta` block every list endpoint returns next to its `data`. */
export function paginationMeta({ page, limit }: Pagination, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
