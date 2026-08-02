import { ApiError } from "../../core/errors.js";
import type {
  CreateTechnicianProfileBody,
  ListTechniciansQuery,
  UpdateVerificationBody,
} from "./technicians.schema.js";

// TASKS 3 & 5 - all database access for technician profiles.
// Reference: src/modules/users/users.service.ts.

/**
 * TASK 3 - the technician submits their details and documents in one go.
 *
 * Two rows change together, so they must both succeed or both fail. Wrap them
 * in `prisma.$transaction(async (tx) => { ... })`:
 *
 *   1. tx.user.update - write fullName / city / address / latitude / longitude
 *      (the details a customer would enter on the profile page) and set
 *      `role: "TECHNICIAN"`
 *   2. tx.technicianProfile.create - categoryId, nationalId,
 *      criminalRecordFile, profileImage, `verificationStatus: "PENDING"`
 *
 * Leave the user's `status` as PENDING. That combination - role TECHNICIAN,
 * verificationStatus PENDING - is what makes the app show "waiting for
 * approval"; see resolveAccountState in modules/users/users.state.ts.
 *
 * Things to get right:
 *   - `userId` is unique on TechnicianProfile, so submitting twice raises
 *     P2002 -> 409 on its own. Good: it stops double submissions.
 *   - Check the user exists and is not soft-deleted before you start.
 *   - A bad `categoryId` raises P2003 -> 409.
 *   - Return the updated user as well as the profile, so the route can call
 *     resolveAccountState(user, profile) instead of hardcoding the state.
 */
export async function createTechnicianProfile(
  data: CreateTechnicianProfileBody,
) {
  // TODO(task 3)
  throw ApiError.notImplemented();
}

/** The profile belonging to a user, or null. Used to build the account state. */
export async function findTechnicianProfileByUserId(userId: bigint) {
  // TODO(task 3): prisma.technicianProfile.findUnique({ where: { userId } })
  throw ApiError.notImplemented();
}

/**
 * TASK 5 - the approval queue. One page of technician profiles, newest first,
 * optionally filtered by verificationStatus, plus the total count.
 *
 * `include: { user: true, category: true }` so the admin sees who and what.
 */
export async function listTechnicians(query: ListTechniciansQuery) {
  // TODO(task 5): copy listUsers - same where/findMany/count shape
  throw ApiError.notImplemented();
}

/**
 * TASK 5 - the admin approves or rejects.
 *
 * Another transaction, because approving touches two rows:
 *
 *   VERIFIED  -> profile.verificationStatus = VERIFIED
 *                AND user.status = ACTIVE      (this is what lets them work)
 *   REJECTED  -> profile.verificationStatus = REJECTED
 *                leave user.status as PENDING so they can submit again
 */
export async function setVerificationStatus(
  technicianProfileId: bigint,
  data: UpdateVerificationBody,
) {
  // TODO(task 5)
  throw ApiError.notImplemented();
}
