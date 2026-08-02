import { z } from "zod";

/**
 * Field rules that more than one module needs. Keeping them here means a rule
 * is changed once, not hunted down in three schemas.
 *
 * Anything used by a single module belongs in that module's own schema file.
 */

/** Phone is the only identity in this app, so the rule matters. */
export const phoneField = z
  .string()
  .trim()
  .regex(/^\+?\d{7,19}$/, "phone must be 7-20 digits, optionally with a +");

/** Our primary keys are BigInt, but a URL always hands us a string. */
export const idField = z
  .string()
  .regex(/^\d+$/, "id must be a positive number")
  .transform(BigInt);

/** `:id` in a URL. Reuse with `z.object({ id: idField })` shape below. */
export const idParams = z.object({ id: idField });
