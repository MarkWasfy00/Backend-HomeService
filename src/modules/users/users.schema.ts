import { z } from "zod";
import { UserRole, UserStatus } from "../../generated/prisma/enums.js";
import { paginationQuery } from "../../core/pagination.js";
import { idField, idParams, phoneField as phone } from "../../core/fields.js";

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

/**
 * POST /customer/profile - screen 5a.
 *
 * The columns are nullable in the database because they are empty between the
 * OTP and this screen; here they are all required, because this is the screen
 * that fills them in.
 *
 * No `userId`: the profile always belongs to the caller, and the route reads
 * that from the token with `currentUser(req)`. Accepting it as a field would
 * let a customer write over somebody else's account.
 */
export const createCustomerProfileBody = z.object(profileFields);

/** PATCH /admin/users/:id/status */
export const updateUserStatusBody = z.object({
  status: z.enum(UserStatus),
});

/**
 * PATCH /me/role - the "customer or technician?" screen.
 *
 * Only the two choices the screen actually offers. ADMIN is deliberately not
 * accepted: this endpoint acts on the caller's own account, so accepting it
 * would let anyone promote themselves.
 */
export const selectRoleBody = z.object({
  role: z.enum([UserRole.CUSTOMER, UserRole.TECHNICIAN]),
});

/**
 * POST /me/signup - the whole of onboarding in one call.
 *
 * The text half of a `multipart/form-data` body: the profile fields every user
 * gives, the role they picked, and - for a technician - the category they work
 * in. The files themselves are not described here; multer takes them off the
 * request and the route turns them into the URLs the service stores.
 *
 * A discriminated union rather than one flat object with optional fields,
 * because `categoryId` is not "optional" - it is required of a technician and
 * meaningless for a customer. This way a technician who forgets it gets a
 * `categoryId` error rather than a foreign key failure three layers down, and
 * a customer who sends one is told plainly that it does not belong.
 *
 * Multipart delivers every value as a string, which is why the numeric fields
 * coerce (`profileFields`) and `categoryId` reuses `idField` - the same
 * string-to-BigInt rule a URL parameter goes through.
 */
export const signUpBody = z.discriminatedUnion("role", [
  z.object({ ...profileFields, role: z.literal(UserRole.CUSTOMER) }),
  z.object({
    ...profileFields,
    role: z.literal(UserRole.TECHNICIAN),
    // The speciality picked on the category screen.
    categoryId: idField,
  }),
]);

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type CreateUserBody = z.infer<typeof createUserBody>;
export type CreateCustomerProfileBody = z.infer<
  typeof createCustomerProfileBody
>;
export type UpdateUserBody = z.infer<typeof updateUserBody>;
export type SelectRoleBody = z.infer<typeof selectRoleBody>;
export type SignUpBody = z.infer<typeof signUpBody>;
