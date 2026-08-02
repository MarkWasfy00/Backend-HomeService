import { Router } from "express";
import { ApiError } from "../../core/errors.js";

/**
 * TASK 5 - the approval queue. Mounted at /api/v1/admin/technicians.
 *
 * This is the other half of "waiting for approval": until an admin calls the
 * verification endpoint below, every technician sits in WAITING_FOR_APPROVAL.
 */
export const techniciansAdminRoutes = Router();

/** GET /api/v1/admin/technicians?verificationStatus=PENDING */
techniciansAdminRoutes.get("/", async (_req, res) => {
  // TODO(task 5): parse listTechniciansQuery, listTechnicians, then reply with
  //   { data: [...toTechnicianProfileAdminResponse], meta: paginationMeta(...) }
  // Copy the list handler from users.admin.routes.ts.
  throw ApiError.notImplemented();
});

/** PATCH /api/v1/admin/technicians/:id/verification */
techniciansAdminRoutes.patch("/:id/verification", async (_req, res) => {
  // TODO(task 5): parse technicianIdParams + updateVerificationBody, then
  // setVerificationStatus. Approving here is what moves the technician from
  // WAITING_FOR_APPROVAL to READY.
  throw ApiError.notImplemented();
});
