import type {
  TechnicianProfile,
  User,
} from "../../generated/prisma/client.js";

/**
 * Where an account is in its journey, and therefore which screen the app shows
 * next. Two columns decide it together, which is why this lives in one
 * function instead of being re-derived on every screen:
 *
 *   User.status                     PENDING / ACTIVE / BLOCKED / SUSPENDED
 *   TechnicianProfile.verificationStatus   PENDING / VERIFIED / REJECTED
 */
export type AccountState =
  /**
   * Customer branch: let them into the app and land them on the profile page.
   * Also the state of a brand new user who has not picked a role yet - the app
   * shows the remaining onboarding steps (category, then customer/technician).
   */
  | "COMPLETE_PROFILE"
  /**
   * Technician branch: they picked "technician", so they get the extra form -
   * national id and criminal record - instead of the plain profile page.
   */
  | "SUBMIT_DOCUMENTS"
  /** Technician submitted their documents; an admin has to approve them. */
  | "WAITING_FOR_APPROVAL"
  /** An admin rejected the documents; the technician can submit again. */
  | "VERIFICATION_REJECTED"
  /** Everything is done - let them into the app. */
  | "READY"
  | "BLOCKED"
  | "SUSPENDED";

/** A default sentence per state. The app is free to show its own wording. */
export const accountStateMessage: Record<AccountState, string> = {
  COMPLETE_PROFILE: "Please complete your profile",
  SUBMIT_DOCUMENTS:
    "Please upload your national ID and criminal record to finish signing up",
  WAITING_FOR_APPROVAL:
    "Your documents are under review. You will be notified once an admin approves your account.",
  VERIFICATION_REJECTED:
    "Your documents were rejected. Please upload them again.",
  READY: "Your account is ready",
  BLOCKED: "This account is blocked",
  SUSPENDED: "This account is suspended",
};

/**
 * The two branches of onboarding split on `role`:
 *
 *   CUSTOMER   → COMPLETE_PROFILE → READY
 *   TECHNICIAN → SUBMIT_DOCUMENTS → WAITING_FOR_APPROVAL → READY
 *
 * A technician never sees COMPLETE_PROFILE: their name, city and location are
 * collected on the same form as their documents, so they go straight from
 * picking the role to the upload screen, and from there to waiting.
 *
 * A technician is also never `READY` on their own - the waiting period lasts
 * until an admin sets the profile to VERIFIED *and* the user to ACTIVE.
 */
export function resolveAccountState(
  user: User,
  technicianProfile: TechnicianProfile | null,
): AccountState {
  if (user.status === "BLOCKED") return "BLOCKED";
  if (user.status === "SUSPENDED") return "SUSPENDED";

  if (user.role === "TECHNICIAN") {
    // Picked "technician" but hasn't sent the national id / criminal record.
    // Note this is NOT COMPLETE_PROFILE - a technician must not be routed to
    // the customer profile page.
    if (!technicianProfile) return "SUBMIT_DOCUMENTS";

    if (technicianProfile.verificationStatus === "REJECTED") {
      return "VERIFICATION_REJECTED";
    }

    if (technicianProfile.verificationStatus === "PENDING") {
      return "WAITING_FOR_APPROVAL";
    }

    // Approved documents, but the admin has not activated the account yet.
    return user.status === "ACTIVE" ? "READY" : "WAITING_FOR_APPROVAL";
  }

  // Customers only have to fill in their profile.
  return user.status === "ACTIVE" ? "READY" : "COMPLETE_PROFILE";
}
