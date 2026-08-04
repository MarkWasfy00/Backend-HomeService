import { z } from "zod";
import { messages } from "./messages.js";

/**
 * The Egyptian national id: the 14 digits printed on the card, kept as text.
 *
 * It is not an opaque number - every part of it means something, which is what
 * makes it worth validating properly rather than counting the digits:
 *
 *   2  98  05  15  01  0123  4
 *   ^  ^   ^   ^   ^   ^     ^
 *   |  |   |   |   |   |     check digit
 *   |  |   |   |   |   serial within that day and governorate
 *   |  |   |   |   governorate the birth was registered in
 *   |  |   |   day
 *   |  |   month
 *   |  year within the century
 *   century: 2 -> 1900s, 3 -> 2000s
 *
 * So a 13th month ("2981315..."), a 30th of February ("2980230...") and a
 * governorate that does not exist are caught here, at the edge, instead of
 * being stored and discovered by whoever has to approve the technician.
 *
 * The 14th digit is a check digit, and it is deliberately *not* verified: the
 * algorithm behind it has never been published, and the versions circulating
 * online reject real cards. A wrong rejection here means a technician who
 * cannot sign up at all, which is far worse than a typo reaching the admin.
 */

const fourteenDigits = /^\d{14}$/;

/** Digit 1. The card has no way to say 1800s, and 4 is not issued yet. */
const centuries: Record<string, number> = { "2": 1900, "3": 2000 };

/**
 * Digits 8-9. The 27 governorates plus 88, which is what someone born outside
 * Egypt gets. The gaps (05-10, 20, 30) are real - the codes were assigned in
 * blocks and never renumbered.
 *
 * Exported for prisma/seed.ts, which has to invent national ids that pass the
 * rules below.
 */
export const governorateCodes = [
  "01", // Cairo
  "02", // Alexandria
  "03", // Port Said
  "04", // Suez
  "11", // Damietta
  "12", // Dakahlia
  "13", // Sharqia
  "14", // Qalyubia
  "15", // Kafr El Sheikh
  "16", // Gharbia
  "17", // Monufia
  "18", // Beheira
  "19", // Ismailia
  "21", // Giza
  "22", // Beni Suef
  "23", // Fayoum
  "24", // Minya
  "25", // Asyut
  "26", // Sohag
  "27", // Qena
  "28", // Aswan
  "29", // Luxor
  "31", // Red Sea
  "32", // New Valley
  "33", // Matrouh
  "34", // North Sinai
  "35", // South Sinai
  "88", // born abroad
] as const;

const isGovernorateCode = new Set<string>(governorateCodes);

/**
 * The birth date digits 1-7 spell out, or null if they do not spell one.
 *
 * `Date` is happy to roll 2001-02-31 over into March, so the parts are read
 * back off the date and compared - that rollover is exactly the mistake this
 * has to catch.
 */
function birthDateOf(nationalId: string): Date | null {
  const century = centuries[nationalId[0]];

  if (century === undefined) {
    return null;
  }

  const year = century + Number(nationalId.slice(1, 3));
  const month = Number(nationalId.slice(3, 5));
  const day = Number(nationalId.slice(5, 7));

  const date = new Date(Date.UTC(year, month - 1, day));

  const rolledOver =
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day;

  return rolledOver ? null : date;
}

/**
 * What is wrong with these 14 digits, in the words the client will see, or null
 * if nothing is. Split out from the schema so the reason is specific: "the
 * birth date is not a real date" is something a user can act on, "invalid
 * nationalId" is not.
 *
 * Only ever called with 14 digits - the field below checks the shape first.
 */
function problemWith(nationalId: string): string | null {
  const birthDate = birthDateOf(nationalId);

  if (!birthDate) {
    return messages.fields.nationalId.birthDate(nationalId.slice(0, 7));
  }

  // A card cannot be issued to someone who has not been born.
  if (birthDate.getTime() > Date.now()) {
    return messages.fields.nationalId.futureBirthDate;
  }

  const governorate = nationalId.slice(7, 9);

  if (!isGovernorateCode.has(governorate)) {
    return messages.fields.nationalId.governorate(governorate);
  }

  return null;
}

/**
 * The field itself. Text, never a file: the number is what the admin checks the
 * technician against, and a photo of a card is neither searchable nor
 * comparable.
 *
 * Shared by `POST /me/signup` and `POST /technician/profile`, so the rule is
 * written once. `.trim()` because multipart form fields arrive with whatever
 * whitespace the keyboard added.
 */
export const nationalIdField = z
  .string()
  .trim()
  .regex(fourteenDigits, messages.fields.nationalId.length)
  .superRefine((value, ctx) => {
    // zod runs every check even once one has failed, so the shape is tested
    // again here. Without it "hello" would be told both that it is not 14
    // digits and that its birth date is wrong, which is just noise.
    if (!fourteenDigits.test(value)) {
      return;
    }

    const problem = problemWith(value);

    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
    }
  });
