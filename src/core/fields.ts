import { z } from "zod";
import { messages } from "./messages.js";

/**
 * Field rules that more than one module needs. Keeping them here means a rule
 * is changed once, not hunted down in three schemas.
 *
 * Anything used by a single module belongs in that module's own schema file.
 */

export const phoneField = z
  .string()
  .trim()
  .regex(/^\+201(?:0|1|2|5)\d{8}$/, messages.fields.phone);

/** Our primary keys are BigInt, but a URL always hands us a string. */
export const idField = z
  .string()
  .regex(/^\d+$/, messages.fields.id)
  .transform(BigInt);

/** `:id` in a URL. Reuse with `z.object({ id: idField })` shape below. */
export const idParams = z.object({ id: idField });
