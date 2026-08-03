import { Router } from "express";
import { ApiError } from "../../core/errors.js";
import { currentUser } from "../auth/auth.middleware.js";
import { toTechnicianProfileResponse } from "../technicians/technicians.mapper.js";
import * as techniciansService from "../technicians/technicians.service.js";
import {
  discardUploads,
  publicUrlFor,
  upload,
  uploadedFilesByField,
} from "../uploads/uploads.storage.js";
import { toUserResponse } from "./users.mapper.js";
import { accountStateMessage, resolveAccountState } from "./users.state.js";
import * as usersService from "./users.service.js";
import type { SignUpData } from "./users.service.js";
import { selectRoleBody, signUpBody, type SignUpBody } from "./users.schema.js";

/**
 * "My own account", mounted at /api/v1/me behind `requireAuth`.
 *
 * Every endpoint here works on the caller and nobody else: there is no `:id`
 * in any of these URLs, because the id comes from the token. That is the whole
 * point of the group - it is impossible to write a handler here that touches
 * someone else's row by accident.
 */
export const usersMeRoutes = Router();

/**
 * GET /api/v1/me
 *
 * Who am I, and which screen should the app be on? The same answer login gives,
 * for an app that already has a token and is starting up again - it saves a
 * round trip through the SMS flow just to learn that a technician was approved.
 */
usersMeRoutes.get("/", async (req, res) => {
  const user = currentUser(req);
  const technicianProfile =
    await techniciansService.findTechnicianProfileByUserId(user.id);

  const accountState = resolveAccountState(user, technicianProfile);

  res.json({
    data: {
      user: toUserResponse(user),
      technicianProfile: technicianProfile
        ? toTechnicianProfileResponse(technicianProfile)
        : null,
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});

/**
 * PATCH /api/v1/me/role
 *
 * The "are you a customer or a technician?" screen. The answer decides which
 * screen comes next, which is why the reply carries `accountState`:
 *
 *   CUSTOMER   -> COMPLETE_PROFILE   open the app, go to the profile page
 *   TECHNICIAN -> SUBMIT_DOCUMENTS   go to the national id / criminal record
 *                                    form instead, then wait for approval
 *
 * The role on the token's own row changes here, so the app must call GET /me
 * (or simply carry on - the next request re-reads the row) rather than trust
 * anything it cached from login.
 */
usersMeRoutes.patch("/role", async (req, res) => {
  const { role } = selectRoleBody.parse(req.body);

  const { user, technicianProfile } = await usersService.selectRole(
    currentUser(req).id,
    role,
  );
  const accountState = resolveAccountState(user, technicianProfile);

  res.json({
    data: {
      user: toUserResponse(user),
      accountState,
      message: accountStateMessage[accountState],
    },
  });
});

/**
 * The three file fields a technician may send. Declaring them is also what
 * rejects everything else: any other file field is a LIMIT_UNEXPECTED_FILE,
 * which the error handler turns into a 400 rather than silently ignoring it.
 */
const documentFields = [
  { name: "nationalId", maxCount: 1 },
  { name: "criminalRecordFile", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
];

/**
 * POST /api/v1/me/signup
 *
 * Onboarding as one call: the profile, the "customer or technician?" answer and
 * - for a technician - the documents, all in a single `multipart/form-data`
 * request. It exists for the app that asks for everything on one form, and
 * replaces this sequence:
 *
 *   PATCH /me/role  →  POST /customer/profile
 *   PATCH /me/role  →  POST /technician/profile  (+ an upload call per file)
 *
 * Those still work, and both paths end in the same place - this one calls the
 * same service, which reaches the same rows through the same transaction.
 *
 * Mounted on /me and not on /customer or /technician on purpose: those groups
 * are behind `requireRole`, and the role is exactly what this endpoint is
 * being told. It is what the caller *becomes*, so it cannot also be the guard.
 *
 * A customer sends no files, so plain `application/json` works for them too -
 * multer stands aside when the request is not multipart.
 */
usersMeRoutes.post(
  "/signup",
  upload.fields(documentFields),
  async (req, res) => {
    const files = uploadedFilesByField(req);

    // The one try/catch in a route file, and it is not error translation - the
    // throw carries on to the error handler untouched. By this line the files
    // are already on disk, so a signup that fails validation or hits a 409 has
    // to take them with it, or every rejected attempt leaves litter behind.
    try {
      const body = signUpBody.parse(req.body);

      const { user, technicianProfile } = await usersService.signUp(
        // Whose signup this is comes from the token, never from the body.
        currentUser(req).id,
        withDocuments(body, files),
      );

      // READY for a customer, WAITING_FOR_APPROVAL for a technician - but
      // resolveAccountState says which, never this route, so the app gets the
      // same answer here as it does from login and GET /me.
      const accountState = resolveAccountState(user, technicianProfile);

      res.status(201).json({
        data: {
          user: toUserResponse(user),
          technicianProfile: technicianProfile
            ? toTechnicianProfileResponse(technicianProfile)
            : null,
          accountState,
          message: accountStateMessage[accountState],
        },
      });
    } catch (error) {
      await discardUploads(Object.values(files));
      throw error;
    }
  },
);

/**
 * Joins the parsed form fields to the files that came with them, which is where
 * the two role-specific rules about files live:
 *
 *   TECHNICIAN  the national id is required, the other two are optional
 *   CUSTOMER    no files at all - `User` has no column to put one in
 *
 * A customer who attaches a file is told so rather than having it quietly
 * dropped: the alternative is a technician who picked the wrong role watching
 * their documents vanish and their account go straight to READY.
 */
function withDocuments(
  body: SignUpBody,
  files: Record<string, Express.Multer.File>,
): SignUpData {
  if (body.role === "CUSTOMER") {
    const attached = Object.keys(files);

    if (attached.length > 0) {
      throw ApiError.badRequest(
        `A customer account has nowhere to store files, but ${attached.join(", ")} was attached. Send documents only with role=TECHNICIAN.`,
      );
    }

    return body;
  }

  const nationalId = files.nationalId;

  if (!nationalId) {
    throw ApiError.badRequest(
      "nationalId is required for a technician - attach the file as multipart/form-data",
    );
  }

  return {
    ...body,
    // What is stored is the URL, never the file - the same string
    // POST /technician/profile is handed by a client that uploaded separately.
    nationalId: publicUrlFor(nationalId),
    criminalRecordFile:
      files.criminalRecordFile && publicUrlFor(files.criminalRecordFile),
    profileImage: files.profileImage && publicUrlFor(files.profileImage),
  };
}
