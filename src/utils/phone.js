const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || "91";

/**
 * Converts user input into international format (+<digits>).
 *  "9876543210"        -> "+919876543210"   (default country code added)
 *  "09876543210"       -> "+919876543210"
 *  "919876543210"      -> "+919876543210"
 *  "+91 98765-43210"   -> "+919876543210"
 * Returns null when the number is not valid.
 */
export function normalizePhone(input) {
  if (input === undefined || input === null) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");

  if (!digits) return null;

  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
  }

  // E.164: max 15 digits, and anything under 8 is not a real number
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

export function buildFullName(firstName = "", lastName = "") {
  return `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
}