import type { TechnicianProfile } from "../../generated/prisma/client.js";
import { ApiError } from "../../core/errors.js";

// TASKS 3 & 5. Reference: src/modules/users/users.mapper.ts.

/**
 * TODO(task 3): return
 *   id                  profile.id.toString()
 *   userId              profile.userId.toString()
 *   categoryId          profile.categoryId.toString()
 *   verificationStatus
 *   isAvailable
 *   overallRating       profile.overallRating.toString()   Decimal -> string
 *   totalReviews
 *   profileImage
 *   createdAt, updatedAt
 *
 * Deliberately NOT returned: `nationalId` and `criminalRecordFile`. They are
 * identity documents - only the admin mapper below should ever expose them.
 */
export function toTechnicianProfileResponse(profile: TechnicianProfile) {
  throw ApiError.notImplemented();
}

/**
 * TODO(task 5): the same fields plus `nationalId` and `criminalRecordFile`,
 * because the admin has to look at them to approve the technician.
 *
 * This is exactly why mappers exist: same row, two audiences, two shapes. Do
 * not be tempted to add a flag to the function above.
 */
export function toTechnicianProfileAdminResponse(profile: TechnicianProfile) {
  throw ApiError.notImplemented();
}
