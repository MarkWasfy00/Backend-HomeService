import { z } from "zod";
import { items, letters, messages } from "./messages.js";

/**
 * Arabic wording for every validation failure the schemas do not word
 * themselves.
 *
 * Most rules in this app carry their own sentence - `phoneField` explains what
 * a phone number looks like, `nationalIdField` explains which digits are wrong.
 * But the plain ones do not: `z.string().trim().min(2).max(100)` on `fullName`
 * has no message at all, so zod falls back to its own, and its own is English
 * ("Too small: expected string to have >=2 characters"). This is the fallback
 * that catches all of those.
 *
 * Installed once, globally, by importing this file (see app.ts). zod applies it
 * to every schema in the process - existing ones included - because it is read
 * at parse time, not at the time the schema was built.
 *
 * It goes in as `localeError` rather than `customError`: that is zod's lowest
 * priority slot, so a message written on a specific field still wins. Which is
 * the right way round - a rule that took the trouble to explain itself always
 * says more than a generic sentence can.
 *
 * None of these name the field they are about. They do not need to: the error
 * handler pairs every message with its `field`, so the response already reads
 *
 *   { "field": "fullName", "message": "لازم يكون حرفين على الأقل" }
 *
 * and repeating the name inside the sentence would only make it clumsier.
 */

/** What the caller should have sent, in Arabic. */
const typeNames: Record<string, string> = {
  string: "نص",
  number: "رقم",
  int: "رقم صحيح",
  bigint: "رقم صحيح",
  boolean: "true أو false",
  date: "تاريخ",
  array: "قائمة",
  object: "بيانات",
  file: "ملف",
  null: "null",
};

function typeName(expected: string) {
  return typeNames[expected] ?? expected;
}

/**
 * How to count whatever was too long or too short. `string` counts letters and
 * `array` counts items; anything else is a bare number - a latitude of -100 is
 * not "-90 of" anything - so it gets no unit.
 */
function sized(origin: string, amount: number | bigint): string | null {
  const n = Number(amount);

  if (origin === "string") return letters(n);
  if (origin === "array" || origin === "set") return items(n);
  return null;
}

const arabicErrors: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      // zod reports a key that was never sent as "expected string, got
      // undefined", which is true but unhelpful. The caller forgot it.
      return issue.input === undefined
        ? "الحقل ده مطلوب"
        : `المفروض تبعت ${typeName(issue.expected)}`;

    case "too_small": {
      const unit = sized(issue.origin, issue.minimum);

      if (unit) {
        return issue.inclusive
          ? `لازم يكون ${unit} على الأقل`
          : `لازم يكون أكتر من ${unit}`;
      }

      return issue.inclusive
        ? `لازم يكون ${issue.minimum} أو أكتر`
        : `لازم يكون أكبر من ${issue.minimum}`;
    }

    case "too_big": {
      const unit = sized(issue.origin, issue.maximum);

      if (unit) {
        return issue.inclusive
          ? `لازم يكون ${unit} على الأكتر`
          : `لازم يكون أقل من ${unit}`;
      }

      return issue.inclusive
        ? `لازم يكون ${issue.maximum} أو أقل`
        : `لازم يكون أصغر من ${issue.maximum}`;
    }

    case "invalid_format":
      return "الصيغة مش مظبوطة";

    case "not_multiple_of":
      return `لازم يكون من مضاعفات ${issue.divisor}`;

    case "invalid_value":
      // One allowed value is a literal - in this app, the `role` that picks a
      // branch of the signup union. Several is an enum.
      return issue.values.length === 1
        ? `القيمة المسموحة هنا هي ${String(issue.values[0])}`
        : `اختار واحدة من دول: ${issue.values.map(String).join(" أو ")}`;

    case "invalid_union":
      // In this app this is the signup body: `role` was missing or was not one
      // of the two branches, so zod could not pick a shape to check against.
      // The issue is reported on the discriminator, so the caller sees this
      // next to `"field": "role"`.
      return "القيمة دي مش من الاختيارات المتاحة";

    case "unrecognized_keys":
      return `في حقول مش متعرّفة: ${issue.keys.join(" و")}`;

    case "invalid_key":
    case "invalid_element":
      return "في قيمة مش مقبولة جوه الطلب";

    default:
      // `custom` (a .refine that forgot its message) and anything a future zod
      // adds. Vague, but Arabic - which beats leaking an English default.
      return messages.validation.invalidRequest;
  }
};

z.config({ localeError: arabicErrors });
