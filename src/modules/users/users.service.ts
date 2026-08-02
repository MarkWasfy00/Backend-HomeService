import type { Prisma } from "../../generated/prisma/client.js";
import type { UserStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../core/prisma.js";
import { ApiError } from "../../core/errors.js";
import { skipTake } from "../../core/pagination.js";
import type {
  CreateCustomerProfileBody,
  CreateUserBody,
  ListUsersQuery,
  SelectRoleBody,
  UpdateUserBody,
} from "./users.schema.js";

// All database access for users lives here. Routes handle HTTP, this file
// handles data and rules - which keeps both easy to read and to test.

// Users are soft-deleted (`deleted_at` is set instead of removing the row),
// so every read must exclude them. Spread this into every `where`.
const notDeleted = { deletedAt: null } satisfies Prisma.UserWhereInput;

/** One page of users, plus the total count for the pagination meta. */
export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...notDeleted,
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search } },
          ],
        }
      : {}),
  };

  // Both queries are independent, so run them at the same time.
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...skipTake(query),
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

/** Returns the user, or `null` when there is no such (non-deleted) user. */
export async function findUserById(id: bigint) {
  return prisma.user.findFirst({ where: { id, ...notDeleted } });
}

/**
 * Same as `findUserById`, but throws a 404 instead of returning null.
 * Use this when the route cannot continue without the user.
 */
export async function getUserById(id: bigint) {
  const user = await findUserById(id);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return user;
}

export async function createUser(data: CreateUserBody) {
  // A duplicate phone raises Prisma's P2002, which the error handler already
  // turns into a 409, so there is nothing to check up front.
  return prisma.user.create({ data });
}

/**
 * The "customer or technician?" screen. Storing the answer is what lets the
 * app send the user down the right branch afterwards - and lets them close the
 * app halfway through and come back to the same screen.
 *
 * Returns the technician profile too (always null here, by definition) so the
 * caller can hand both to `resolveAccountState`.
 */
export async function selectRole(userId: bigint, role: SelectRoleBody["role"]) {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...notDeleted },
    include: { technicianProfile: true },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Once onboarding is done the role is settled. Changing it afterwards would
  // strand a technician's profile, reviews and offers on a customer account.
  if (user.technicianProfile) {
    throw ApiError.conflict(
      "Documents were already submitted, the role can no longer change",
    );
  }

  if (user.status !== "PENDING") {
    throw ApiError.conflict("This account has already finished signing up");
  }

  const updated = await updateUserFields(userId, { role });

  return { user: updated, technicianProfile: null };
}

/**
 * Screen 5a: the customer fills in the details that were left blank when their
 * phone was verified. It does not create a user - that row exists already - it
 * completes it, which is what turns `accountState` into READY.
 *
 * The details and `status: ACTIVE` are written in one update on purpose: a
 * half-applied profile would leave an ACTIVE user with no name, or a complete
 * user still stuck on the profile screen.
 */
export async function completeCustomerProfile(
  userId: bigint,
  data: CreateCustomerProfileBody,
) {
  const user = await getUserById(userId);

  // The same guard selectRole uses. Without it this endpoint would reset a
  // finished account's details, and re-activate a suspended one.
  if (user.status !== "PENDING") {
    throw ApiError.conflict("This account has already finished signing up");
  }

  return updateUserFields(userId, { ...data, status: "ACTIVE" });
}

export async function updateUser(id: bigint, data: UpdateUserBody) {
  return updateUserFields(id, data);
}

/**
 * Writes any set of columns to a non-deleted user and returns the fresh row.
 *
 * `updateMany` (rather than `update`) lets us apply the soft-delete filter, so
 * a deleted user can never be modified; a count of 0 means "no such user".
 */
async function updateUserFields(id: bigint, data: Prisma.UserUpdateManyMutationInput) {
  const { count } = await prisma.user.updateMany({
    where: { id, ...notDeleted },
    data,
  });

  if (count === 0) {
    throw ApiError.notFound("User not found");
  }

  return getUserById(id);
}

/** Activate / block / suspend a user. */
export async function setUserStatus(id: bigint, status: UserStatus) {
  return updateUserFields(id, { status });
}

/** Marks the user deleted. The row stays for history and reporting. */
export async function softDeleteUser(id: bigint) {
  const { count } = await prisma.user.updateMany({
    where: { id, ...notDeleted },
    data: { deletedAt: new Date() },
  });

  if (count === 0) {
    throw ApiError.notFound("User not found");
  }
}
