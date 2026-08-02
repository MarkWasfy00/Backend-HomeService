import { z } from "zod";
import { idParams } from "../../core/fields.js";
import { paginationQuery } from "../../core/pagination.js";

// TASKS 3 & 5 - Technician profiles. See docs/ONBOARDING-FLOW.md.

export const technicianIdParams = idParams;

/**
 * POST /technician/profile - screen 5b.
 *
 * A technician never sees the customer profile page, so this one form collects
 * *everything*: the same personal details a customer fills in, plus the two
 * documents. That is the "more inputs" half of the technician branch.
 *
 * TODO(task 3): add the fields.
 *
 *   -- the same details a customer gives (they go on the User row) --
 *   userId               idField from core/fields.ts (temporary - comes from
 *                        the JWT once auth exists)
 *   fullName             string, trimmed, 2-100
 *   city                 string, trimmed, 1-100
 *   address              string, trimmed, min 1
 *   latitude             number, -90..90
 *   longitude            number, -180..180
 *
 *   -- technician-only (they go on the TechnicianProfile row) --
 *   categoryId           idField - the speciality picked back on screen 3
 *   nationalId           string, 1-255 chars. This is a URL from the upload
 *                        endpoint, NOT the number and NOT the file itself.
 *   criminalRecordFile   same, optional
 *   profileImage         same, optional
 *
 * Tip: import `profileFields` from users.schema.ts rather than retyping the
 * first five - one definition, one set of rules.
 */
export const createTechnicianProfileBody = z.object({});

/**
 * PATCH /admin/technicians/:id/verification - task 5, the admin decides.
 *
 * TODO(task 5): { verificationStatus: "VERIFIED" | "REJECTED" }
 * Use `z.enum(VerificationStatus)` from generated/prisma/enums.js, then narrow
 * it - PENDING is not a decision an admin can submit.
 */
export const updateVerificationBody = z.object({});

/**
 * GET /admin/technicians - task 5, the approval queue.
 *
 * TODO(task 5): extend with an optional `verificationStatus` filter so admins
 * can list just the PENDING ones. Copy listUsersQuery.
 */
export const listTechniciansQuery = paginationQuery;

export type CreateTechnicianProfileBody = z.infer<
  typeof createTechnicianProfileBody
>;
export type UpdateVerificationBody = z.infer<typeof updateVerificationBody>;
export type ListTechniciansQuery = z.infer<typeof listTechniciansQuery>;
