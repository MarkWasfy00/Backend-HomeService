import { z } from "zod";
import { UserRole, UserStatus } from "../../generated/prisma/enums.js";
import { paginationQuery } from "../../core/pagination.js";
import { idParams, phoneField as phone } from "../../core/fields.js";

// Every shape the users API accepts is declared here, and nowhere else.
// Routes call `someSchema.parse(...)`; a failure is turned into a 400 by the
// error handler, so there is nothing to catch.

/** `:id` in the URL arrives as a string; our ids are BigInt. */
export const userIdParams = idParams;

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/**
 * The personal details every user gives, whichever branch of onboarding they
 * took. Exported because the technician form asks for exactly the same five
 * on top of its documents - one definition, one set of rules.
 */
export const profileFields = {
  fullName: z.string().trim().min(2).max(100),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1),
  latitude,
  longitude,
};

/** GET /admin/users */
export const listUsersQuery = paginationQuery.extend({
  role: z.enum(UserRole).optional(),
  status: z.enum(UserStatus).optional(),
  city: z.string().trim().min(1).optional(),
  // Matches against full name or phone.
  search: z.string().trim().min(1).optional(),
});

/** POST /admin/users */
export const createUserBody = z.object({
  ...profileFields,
  phone,
  role: z.enum(UserRole).default(UserRole.CUSTOMER),
  status: z.enum(UserStatus).default(UserStatus.PENDING),
});

/** PATCH /admin/users/:id - role and status have their own endpoint. */
export const updateUserBody = z
  .object({ ...profileFields, phone })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update",
  });

/** PATCH /admin/users/:id/status */
export const updateUserStatusBody = z.object({
  status: z.enum(UserStatus),
});

/**
 * PATCH /public/onboarding/:id/role - the "customer or technician?" screen.
 *
 * Only the two choices the screen actually offers. ADMIN is deliberately not
 * accepted: nobody may promote themselves to admin over a public endpoint.
 */
export const selectRoleBody = z.object({
  role: z.enum([UserRole.CUSTOMER, UserRole.TECHNICIAN]),
});

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type CreateUserBody = z.infer<typeof createUserBody>;
export type UpdateUserBody = z.infer<typeof updateUserBody>;
export type SelectRoleBody = z.infer<typeof selectRoleBody>;
